-- "Liked by" lists for comments.
CREATE INDEX "comment_likes_comment_idx" ON "comment_likes" USING btree ("comment_id") WHERE "comment_likes"."deleted_at" is null;