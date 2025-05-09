(ns metabase-enterprise.serialization.v2.load
  "Loading is the interesting part of deserialization: integrating the maps \"ingested\" from files into the appdb.
  See the detailed breakdown of the (de)serialization processes in [[metabase.models.serialization]]."
  (:require
   [medley.core :as m]
   [metabase-enterprise.serialization.v2.backfill-ids :as serdes.backfill]
   [metabase-enterprise.serialization.v2.ingest :as serdes.ingest]
   [metabase-enterprise.serialization.v2.models :as serdes.models]
   [metabase.models.serialization :as serdes]
   [metabase.util :as u]
   [metabase.util.log :as log]
   [toucan2.core :as t2]
   [toucan2.model :as t2.model]))

(declare load-one!)

(def ^:private model->circular-dependency-keys
  "Sometimes models have circular dependencies. For example, a card for a Dashboard Question has a `dashboard_id`
  pointing to the dashboard it's in. But when we try to load that dashboard, we'll create all its dashcards, and one
  of those dashcards will point to the card we started with.

  This map works around this: given a model (e.g. `Card`) that triggered a dependency loop, it provides a set of paths to
  keys to remove from the model so that we'll be able to successfully load it. You can remove keys in vectors using :* to
  indicate that all items in that vector should have a key removed."
  {"Dashboard" #{[:dashcards :* :visualization_settings]}
   "Card" #{[:dashboard_id]}})

(defn- remove-by-path
  [entity [first-key & rest]]
  (cond
    (empty? rest) (dissoc entity first-key)
    (= :* first-key) (mapv #(remove-by-path % rest) entity)
    :else (update entity first-key remove-by-path rest)))

(defn- without-references
  "Remove references to other entities from a given one. Used to break circular dependencies when loading."
  [model entity]
  (let [keys-to-remove (or (model->circular-dependency-keys model)
                           (throw (ex-info "Don't know which keys to remove to break circular dependency!"
                                           {:entity entity
                                            :model model
                                            :error ::no-known-references})))]
    (reduce remove-by-path entity keys-to-remove)))

(defn- load-deps!
  "Given a list of `deps` (hierarchies), [[load-one]] them all.
  If [[load-one]] throws because it can't find that entity in the filesystem, check if it's already loaded in
  our database."
  [ctx deps]
  (if (empty? deps)
    ctx
    (letfn [(loader [ctx dep]
              (try
                (load-one! ctx dep)
                (catch Exception e
                  (cond
                    ;; It was missing, but we found it locally, so just return the context.
                    (and (= (:error (ex-data e)) ::not-found)
                         (serdes/load-find-local dep))
                    ctx

                    ;; It's a circular dep, strip off probable cause and retry. This will store an incomplete version
                    ;; of an entity, but this is not a problem - a full version is waiting to be stored up the stack.
                    (= (:error (ex-data e)) ::circular)
                    (let [model (:model (ex-data e))]
                      (log/debug "Detected circular dependency" (serdes/log-path-str dep))
                      (load-one! (update ctx :expanding disj dep) dep (partial without-references model)))

                    :else
                    (throw e)))))]
      (reduce loader ctx deps))))

(defn- path-error-data [error-type expanding path]
  (let [last-model (:model (last path))]
    {:path       (mapv (partial into {}) path)
     :deps-chain (set (map #(mapv (partial into {}) %) expanding))
     :model      last-model
     :table      (some->> last-model (keyword "model") t2/table-name)
     :error      error-type}))

(defn- valid-model-name-for-load? [model-name]
  ;; linear scan, but small n
  (->> (concat serdes.models/inlined-models
               serdes.models/exported-models)
       (some #{model-name})
       boolean))

(defn- exported-with-entity-id?
  "Returns true if entities with the given model-name should have been exported with an entity_id."
  [model-name]
  (when (valid-model-name-for-load? model-name)
    (let [model (t2.model/resolve-model (symbol model-name))]
      (serdes.backfill/has-entity-id? model))))

(defn- load-one!
  "Loads a single entity, specified by its `:serdes/meta` abstract path, into the appdb, doing some bookkeeping to
  avoid cycles.

  If the incoming entity has any dependencies, they are recursively processed first (postorder) so that any foreign
  key references in this entity can be resolved properly.

  This is mostly bookkeeping for the overall deserialization process - the actual load of any given entity is done by
  [[metabase.models.serialization/load-one!]] and its various overridable parts, which see.

  Error is thrown on a circular dependency, should be handled and retried at the caller. `modfn` is an optional
  parameter to modify entity data after reading and before other processing (before loading dependencies, finding
  local version, and storing in the db)."
  [{:keys [expanding ingestion seen] :as ctx} path & [modfn]]
  (log/infof "Loading %s" (serdes/log-path-str path))
  (cond
    (expanding path) (throw (ex-info (format "Circular dependency on %s" (serdes/log-path-str path))
                                     (path-error-data ::circular expanding path)))
    (seen path) ctx ; Already been done, can skip it.
    :else (let [ingested (try
                           (serdes.ingest/ingest-one ingestion path)
                           (catch Exception e
                             (throw (ex-info (format "Failed to read file for %s" (serdes/log-path-str path))
                                             (path-error-data ::not-found expanding path)
                                             e))))
                ;; Use the abstract path as attached by the ingestion process, not the original one we were passed.
                rebuilt-path (serdes/path ingested)
                ;; If nil or absent :entity_id is taken as a signal to create a new entity
                ;; To get a nil entity_id, a user has to manually set the entity_id to null or remove it
                ;; in the yaml file.
                ;; In all other cases we should expect an :entity_id:
                ;; - exported entities have a :entity_id for every model that can have one
                ;; - backfill (pre import) guarantees all entities have ids in the appdb
                expect-entity-id (some-> rebuilt-path peek :model exported-with-entity-id?)
                require-new-entity (and expect-entity-id (nil? (:entity_id ingested)))
                ingested (cond-> ingested
                           require-new-entity (assoc :entity_id (u/generate-nano-id))
                           modfn modfn)
                deps     (serdes/dependencies ingested)
                _        (log/debug "Loading dependencies" deps)
                ctx      (-> ctx
                             (update :expanding conj path)
                             (load-deps! deps)
                             (update :seen conj path)
                             (update :expanding disj path))
                local-or-nil (when-not require-new-entity (serdes/load-find-local rebuilt-path))]
            (try
              (serdes/load-one! ingested local-or-nil)
              ctx
              (catch Exception e
                ;; ugly mapv here to convered #ordered/map into normal map so it's readable in the logs
                (throw (ex-info (format "Failed to load into database for %s" (serdes/log-path-str path))
                                (path-error-data ::load-failure expanding path)
                                e)))))))

(defn load-metabase!
  "Loads in a database export from an ingestion source, which is any Ingestable instance."
  [ingestion & {:keys [backfill? continue-on-error]
                :or   {backfill?   true
                       continue-on-error false}}]
  (t2/with-transaction [_tx]
    ;; We proceed in the arbitrary order of ingest-list, deserializing all the files. Their declared dependencies
    ;; guide the import, and make sure all containers are imported before contents, etc.
    (when backfill?
      (serdes.backfill/backfill-ids!))
    (let [contents (serdes.ingest/ingest-list ingestion)
          ctx      {:expanding #{}
                    :seen      #{}
                    :ingestion ingestion
                    :from-ids  (m/index-by :id contents)
                    :errors    []}]
      (log/infof "Starting deserialization, total %s documents" (count contents))
      (reduce (fn [ctx item]
                (try
                  (load-one! ctx item)
                  (catch Exception e
                    (when-not continue-on-error
                      (throw e))
                    ;; eschew big and scary stacktrace
                    (log/warnf "Skipping deserialization error: %s %s" (ex-message e) (ex-data e))
                    (update ctx :errors conj e))))
              ctx
              contents))))
