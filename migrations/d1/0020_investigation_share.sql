Warning: f was declared with const; use let for reassignable variables.
ALTER TABLE investigations ADD COLUMN share_token_hash TEXT;
CREATE UNIQUE INDEX idx_investigations_share_token ON investigations(share_token_hash);
