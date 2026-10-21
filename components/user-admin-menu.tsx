"use client";
// A profile's "⋯" menu for admins (someone else's profile): suspend or unsuspend, clear the bio,
// reset the handle. Each asks for a reason in its popup (ModerateButton).
import {
  clearBioAction,
  resetHandleAction,
  suspendUserAction,
  unsuspendUserAction,
} from "@/app/actions";
import { ModerateButton } from "@/components/moderate-button";
import { MENU_ICON, MenuIcon, menuDanger, menuItem, MoreMenu } from "@/components/more-menu";
import { useMenu } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";

export function UserAdminMenu(p: { userId: string; suspended: boolean; hasBio: boolean }) {
  const menu = useMenu();
  const done = () => menu.setOpen(false);
  return (
    <MoreMenu menu={menu}>
      {p.suspended ? (
        <ModerateButton
          label={he.moderation.unsuspend}
          action={unsuspendUserAction.bind(null, p.userId)}
          triggerClass={menuItem}
          icon={<MenuIcon d={MENU_ICON.unsuspend} />}
          onDone={done}
        />
      ) : (
        <ModerateButton
          label={he.moderation.suspend}
          danger
          action={suspendUserAction.bind(null, p.userId)}
          triggerClass={menuDanger}
          icon={<MenuIcon d={MENU_ICON.suspend} />}
          onDone={done}
        />
      )}
      {p.hasBio && (
        <ModerateButton
          label={he.moderation.clearBio}
          danger
          action={clearBioAction.bind(null, p.userId)}
          triggerClass={menuDanger}
          icon={<MenuIcon d={MENU_ICON.clearBio} />}
          onDone={done}
        />
      )}
      <ModerateButton
        label={he.moderation.resetHandle}
        danger
        action={resetHandleAction.bind(null, p.userId)}
        triggerClass={menuDanger}
        icon={<MenuIcon d={MENU_ICON.resetHandle} />}
        onDone={done}
      />
    </MoreMenu>
  );
}
