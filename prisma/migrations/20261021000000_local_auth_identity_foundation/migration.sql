-- Swim Flow: staged transition away from Supabase Auth.
-- Schema only. No existing identities/users/passwords are imported.
-- Never store plaintext passwords or bearer tokens in these columns.
CREATE TABLE "local_auth_identities" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255),
    "email_confirmed_at" TIMESTAMPTZ(6),
    "last_sign_in_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "local_auth_identities_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "local_auth_action_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_auth_action_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "local_auth_identities_email_key"
    ON "local_auth_identities"("email");

CREATE UNIQUE INDEX "local_auth_action_tokens_token_hash_key"
    ON "local_auth_action_tokens"("token_hash");

CREATE INDEX "local_auth_action_tokens_user_id_purpose_expires_at_idx"
    ON "local_auth_action_tokens"("user_id", "purpose", "expires_at");

ALTER TABLE "local_auth_identities"
    ADD CONSTRAINT "local_auth_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "local_auth_action_tokens"
    ADD CONSTRAINT "local_auth_action_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "local_auth_identities"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- All canonical emails stored in the identity table must be normalized.
ALTER TABLE "local_auth_identities"
    ADD CONSTRAINT "local_auth_identity_normalized_email_chk"
    CHECK ("email" = lower(btrim("email")) AND length("email") > 3);

-- Tokens are cryptographically hashed SHA-256 digests, never raw links/codes.
ALTER TABLE "local_auth_action_tokens"
    ADD CONSTRAINT "local_auth_token_digest_chk"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "local_auth_action_tokens"
    ADD CONSTRAINT "local_auth_token_purpose_chk"
    CHECK ("purpose" IN ('INVITATION', 'PASSWORD_RESET'));

ALTER TABLE "local_auth_action_tokens"
    ADD CONSTRAINT "local_auth_token_expiry_chk"
    CHECK ("expires_at" > "created_at");

ALTER TABLE "local_auth_action_tokens"
    ADD CONSTRAINT "local_auth_token_consumption_chk"
    CHECK ("used_at" IS NULL OR "used_at" >= "created_at");
