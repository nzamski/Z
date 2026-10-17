CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON "posts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON "comments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER likes_set_updated_at BEFORE UPDATE ON "likes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER follows_set_updated_at BEFORE UPDATE ON "follows" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
