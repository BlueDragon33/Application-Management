-- Remove the retired TinyFish integration and its stored credential/data.
DELETE FROM deploy_ops_credentials WHERE provider = 'tinyfish';

DROP INDEX IF EXISTS deploy_ops_runs_tinyfish_run_idx;

ALTER TABLE deploy_ops_targets DROP COLUMN tinyfish_goal;
ALTER TABLE deploy_ops_targets DROP COLUMN tinyfish_target_url;
ALTER TABLE deploy_ops_targets DROP COLUMN tinyfish_enabled;

ALTER TABLE deploy_ops_runs DROP COLUMN callback_nonce_hash;
ALTER TABLE deploy_ops_runs DROP COLUMN tinyfish_result_json;
ALTER TABLE deploy_ops_runs DROP COLUMN tinyfish_status;
ALTER TABLE deploy_ops_runs DROP COLUMN tinyfish_run_id;
