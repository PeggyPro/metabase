(ns metabase.channel.email.result-attachment
  (:require
   [clojure.java.io :as io]
   [metabase.driver :as driver]
   [metabase.driver.util :as driver.u]
   [metabase.lib.schema.id :as lib.schema.id]
   [metabase.query-processor.store :as qp.store]
   [metabase.query-processor.streaming :as qp.streaming]
   [metabase.query-processor.streaming.common :as streaming.common]
   [metabase.query-processor.streaming.interface :as qp.si]
   [metabase.util.i18n :refer [tru]]
   [metabase.util.log :as log]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]
   [metabase.util.performance :as perf])
  (:import
   (java.io File IOException OutputStream)))

(set! *warn-on-reflection* true)

(mu/defn- stream-api-results-to-export-format!
  "For legacy compatibility. Takes QP results in the normal `:api` response format and streams them to a different
  format.

  TODO -- this function is provided mainly because rewriting all the Pulse/Alert code to stream results directly
  was a lot of work. I intend to rework that code so we can stream directly to the correct export format(s) at some
  point in the future; for now, this function is a stopgap.

  Results are streamed synchronously. Caller is responsible for closing `os` when this call is complete."
  [^OutputStream os                                              :- (ms/InstanceOfClass OutputStream)
   {:keys [export-format format-rows? pivot?], :as _options}     :- [:map
                                                                     [:export-format :keyword]
                                                                     [:format-rows?  {:optional true} [:maybe :boolean]]
                                                                     [:pivot?        {:optional true} [:maybe :boolean]]]
   {{:keys [rows]} :data, database-id :database_id, :as results} :- [:map
                                                                     [:database_id ::lib.schema.id/database]]]
  ;; make sure Database/driver info is available for the streaming results writers -- they might need this in order to
  ;; get timezone information when writing results
  (log/debugf "Streaming results to %s with %d rows" export-format (:row_count results))
  (driver/with-driver (driver.u/database->driver database-id)
    (qp.store/with-metadata-provider database-id
      (let [w                           (qp.si/streaming-results-writer export-format os)
            cols                        (-> results :data :cols)
            viz-settings                (-> results :data :viz-settings)
            [ordered-cols output-order] (qp.streaming/order-cols cols viz-settings)
            viz-settings'               (assoc viz-settings :output-order output-order)]
        (qp.si/begin! w
                      (-> results
                          (assoc-in [:data :format-rows?] format-rows?)
                          (assoc-in [:data :pivot?] pivot?)
                          (assoc-in [:data :ordered-cols] ordered-cols))
                      viz-settings')
        (perf/reduce (fn [_ i row]
                       (qp.si/write-row! w row i ordered-cols viz-settings'))
                     nil (range) rows)
        (qp.si/finish! w results)))))

(defn- create-temp-file!
  "Separate from `create-temp-file-or-throw` primarily so that we can simulate exceptions in tests"
  [suffix]
  (doto (File/createTempFile "metabase_attachment" suffix)
    .deleteOnExit))

(defn- create-temp-file-or-throw!
  "Tries to create a temp file, will give the users a better error message if we are unable to create the temp file"
  [suffix]
  (try
    (create-temp-file! suffix)
    (catch IOException e
      (let [ex-msg (tru "Unable to create temp file in `{0}` for email attachments "
                        (System/getProperty "java.io.tmpdir"))]
        (throw (IOException. ex-msg e))))))

(defn- create-result-attachment-map [export-type card-name ^File attachment-file]
  (let [{:keys [content-type]} (qp.si/stream-options export-type)]
    {:type         :attachment
     :content-type content-type
     :file-name    (format "%s_%s.%s"
                           (or card-name "query_result")
                           (streaming.common/export-filename-timestamp)
                           (name export-type))
     :content      (-> attachment-file .toURI .toURL)
     :description  (format "More results for '%s'" card-name)}))

(defn result-attachment
  "Create result attachments for an email."
  [{{original-card-name :name format-rows :format_rows pivot-results :pivot_results :as card} :card
    dashcard :dashcard
    result :result
    :as part}]
  (when (pos-int? (:row_count result))
    (let [maybe-realize-data-rows (requiring-resolve 'metabase.channel.shared/maybe-realize-data-rows)
          result            (:result (maybe-realize-data-rows part))
          visualizer-title (when (and dashcard (get-in dashcard [:visualization_settings :visualization]))
                             (not-empty (get-in dashcard [:visualization_settings :visualization :settings :card.title])))
          filename-prefix  (or visualizer-title original-card-name)]
      (->>
       [(when-let [temp-file (and (:include_csv card)
                                  (create-temp-file-or-throw! "csv"))]
          (with-open [os (io/output-stream temp-file)]
            (stream-api-results-to-export-format! os {:export-format :csv :format-rows? format-rows :pivot? pivot-results} result))
          (create-result-attachment-map "csv" filename-prefix temp-file))
        (when-let [temp-file (and (:include_xls card)
                                  (create-temp-file-or-throw! "xlsx"))]
          (with-open [os (io/output-stream temp-file)]
            (stream-api-results-to-export-format! os {:export-format :xlsx :format-rows? format-rows :pivot? pivot-results} result))
          (create-result-attachment-map "xlsx" filename-prefix temp-file))]
       (filterv some?)))))
