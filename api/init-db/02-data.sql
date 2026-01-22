-- Initial seed data
-- Creates a default admin user for first login

-- Users - Default admin account
-- IMPORTANT: Change the password immediately after first login
DELETE FROM "users";
INSERT INTO "users" ("id", "username", "email", "password_hash", "first_name", "last_name", "role", "is_active", "created_at", "updated_at", "last_login") VALUES
  (1, 'admin', 'admin@example.com', '$2b$10$placeholder_change_on_first_login', 'System', 'Administrator', 'admin', TRUE, NOW(), NOW(), NULL);

-- Invite codes - Default invite code for initial setup
DELETE FROM "invite_codes";
INSERT INTO "invite_codes" ("id", "code", "email", "created_by", "used_by", "max_uses", "uses_count", "expires_at", "created_at", "used_at", "is_active", "notes") VALUES
  (1, 'WELCOME2025', NULL, NULL, NULL, 10, 0, NOW() + INTERVAL '1 year', NOW(), NULL, TRUE, 'Initial invite code for new users');

-- Reset sequences
SELECT setval('users_id_seq', 1);
SELECT setval('invite_codes_id_seq', 1);
