"use client";
// Profile bio; its owner can edit it in place.
import { useState } from "react";
import { updateBioAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import { PlainText } from "@/components/post-card";
import { he } from "@/lib/i18n/he";

export function ProfileBio(p: { bio: string; isSelf: boolean; max: number }) {
  const [editing, setEditing] = useState(false);
  // Show the saved text right away instead of the old prop until refresh() lands.
  const [bio, setBio] = useState(p.bio);
  const [prop, setProp] = useState(p.bio);
  if (prop !== p.bio) {
    setProp(p.bio);
    setBio(p.bio);
  }
  if (editing) {
    return (
      <div className="mt-2">
        <Composer
          action={async (prev, f) => {
            const r = await updateBioAction(prev, f);
            if (r.ok) setBio(String(f.get("body") ?? "").trim());
            return r;
          }}
          initial={bio}
          max={p.max}
          rows={2}
          allowEmpty
          placeholder={he.profile.bioPlaceholder}
          submitLabel={he.composer.save}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <>
      {bio && <PlainText text={bio} className="mt-2" />}
      {p.isSelf && (
        <button onClick={() => setEditing(true)} className="mt-1 text-sm text-link hover:underline">
          {bio ? he.profile.editBio : he.profile.addBio}
        </button>
      )}
    </>
  );
}
