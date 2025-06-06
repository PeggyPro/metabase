(ns metabase-enterprise.advanced-permissions.api.monitoring-test
  "Permisisons tests for API that needs to be enforced by Application Permissions of type `:monitoring`."
  (:require
   [clojure.test :refer :all]
   [metabase.permissions.models.permissions :as perms]
   [metabase.test :as mt]))

(deftest task-test
  (testing "/api/task/*"
    (mt/with-user-in-groups [group {:name "New Group"}
                             user  [group]]
      (mt/with-temp [:model/TaskHistory task]
        (letfn [(get-tasks [user status]
                  (testing (format "get task with %s user" (mt/user-descriptor user))
                    (mt/user-http-request user :get status "task")))
                (get-single-task [user status]
                  (mt/user-http-request user :get status (format "task/%d" (:id task))))
                (get-task-info [user status]
                  (testing (format "get task info with %s user" (mt/user-descriptor user))
                    (mt/user-http-request user :get status "task/info")))]
          (testing "if `advanced-permissions` is disabled, require admins"
            (mt/with-premium-features #{}
              (get-tasks user 403)
              (get-single-task user 403)
              (get-task-info user 403)
              (get-tasks :crowberto 200)
              (get-single-task :crowberto 200)
              (get-task-info :crowberto 200)))

          (testing "if `advanced-permissions` is enabled"
            (mt/with-premium-features #{:advanced-permissions}
              (testing "still fail if user's group doesn't have `monitoring` permission"
                (get-tasks user 403)
                (get-single-task user 403)
                (get-task-info user 403))

              (testing "allowed if user's group has `monitoring` permission"
                (perms/grant-application-permissions! group :monitoring)
                (get-tasks user 200)
                (get-single-task user 200)
                (get-task-info user 200)))))))))

(deftest logs-permissions-test
  (testing "GET /api/logger/logs"
    (mt/with-user-in-groups [group {:name "New Group"}
                             user  [group]]
      (letfn [(get-logs [user status]
                (testing (format "get logs with %s user" (mt/user-descriptor user))
                  (mt/user-http-request user :get status "logger/logs")))]
        (testing "if `advanced-permissions` is disabled, require admins"
          (mt/with-premium-features #{}
            (get-logs user 403)
            (get-logs :crowberto 200)))
        (testing "if `advanced-permissions` is enabled"
          (mt/with-premium-features #{:advanced-permissions}
            (testing "still fail if user's group doesn't have `monitoring` permission"
              (get-logs user 403))
            (testing "allowed if user's group has `monitoring` permission"
              (perms/grant-application-permissions! group :monitoring)
              (get-logs user 200))))))))

(deftest bug-reporting-permissions-test
  (testing "GET /api/bug-reporting/details"
    (mt/with-user-in-groups [group {:name "New Group"}
                             user  [group]]
      (letfn [(get-bug-report-detail [user status]
                (testing (format "get bug report details with %s user" (mt/user-descriptor user))
                  (mt/user-http-request user :get status "bug-reporting/details")))]
        (testing "if `advanced-permissions` is disabled, require admins"
          (mt/with-premium-features #{}
            (get-bug-report-detail user 403)
            (get-bug-report-detail :crowberto 200)))
        (testing "if `advanced-permissions` is enabled"
          (mt/with-premium-features #{:advanced-permissions}
            (testing "still fail if user's group doesn't have `monitoring` permission"
              (get-bug-report-detail user 403))
            (testing "allowed if user's group has `monitoring` permission"
              (perms/grant-application-permissions! group :monitoring)
              (get-bug-report-detail user 200))))))))

(deftest connection-pool-info-permissions-test
  (testing "GET /api/bug-reporting/connection-pool-details"
    (mt/with-user-in-groups [group {:name "New Group"}
                             user  [group]]
      (letfn [(get-db-connection-info [user status]
                (testing (format "get db connection info with %s user" (mt/user-descriptor user))
                  (mt/user-http-request user :get status "bug-reporting/connection-pool-details")))]
        (testing "if `advanced-permissions` is disabled, require admins"
          (mt/with-premium-features #{}
            (get-db-connection-info user 403)
            (get-db-connection-info :crowberto 200)))
        (testing "if `advanced-permissions` is enabled"
          (mt/with-premium-features #{:advanced-permissions}
            (testing "still fail if user's group doesn't have `monitoring` permission"
              (get-db-connection-info user 403))
            (testing "allowed if user's group has `monitoring` permission"
              (perms/grant-application-permissions! group :monitoring)
              (get-db-connection-info user 200))))))))

(deftest anonymous-stats-permission-test
  (testing "GET /api/analytics/anonymous-stats"
    (mt/with-user-in-groups [group {:name "New Group"}
                             user  [group]]
      (letfn [(get-stats [user status]
                (testing (format "get stats with %s user" (mt/user-descriptor user))
                  (mt/user-http-request user :get status "analytics/anonymous-stats")))]
        (testing "if `advanced-permissions` is disabled, require admins"
          (mt/with-premium-features #{}
            (get-stats user 403)))
        (testing "if `advanced-permissions` is enabled"
          (mt/with-premium-features #{:advanced-permissions}
            (testing "still fail if user's group doesn't have `monitoring` permission"
              (get-stats user 403))
            (testing "allowed if user's group has `monitoring` permission"
              (perms/grant-application-permissions! group :monitoring)
              (get-stats user 200))))))))

(deftest persistence-test
  (testing "/api/persist"
    (mt/with-user-in-groups [group {:name "New Group"}
                             user [group]]
      (letfn [(fetch-persisted-info [user status]
                (testing (format "persist with %s user" (mt/user-descriptor user))
                  (mt/user-http-request user :get status "persist")))]

        (testing "if `advanced-permissions` is disabled, require admins,"
          (fetch-persisted-info :crowberto 200)
          (fetch-persisted-info user 403)
          (fetch-persisted-info :rasta 403))

        (testing "if `advanced-permissions` is enabled"
          (mt/with-premium-features #{:advanced-permissions}
            (testing "still fail if user's group doesn't have `setting` permission,"
              (fetch-persisted-info :crowberto 200)
              (fetch-persisted-info user 403)
              (fetch-persisted-info :rasta 403))

            (testing "succeed if user's group has `monitoring` permission,"
              (perms/grant-application-permissions! group :monitoring)
              (fetch-persisted-info :crowberto 200)
              (fetch-persisted-info user 200)
              (fetch-persisted-info :rasta 403))))))))
