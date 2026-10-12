import { ArrowLeft, ArrowRight, ListX, Palette, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export interface GroupMenuItemsProps {
  variant: 'dropdown' | 'context';
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: () => void;
  onChangeColor: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  missingCount: number;
  onRemoveMissing: () => void;
  /** WR-08: set while a fetch is in flight; the item stays visible but disabled with this hint. */
  removeMissingDisabledReason?: string | null;
  onDelete: () => void;
}

/** Shared item list for the group `…` DropdownMenu and the right-click ContextMenu (D-03). */
export function GroupMenuItems({
  variant,
  canMoveLeft,
  canMoveRight,
  onRename,
  onChangeColor,
  onMoveLeft,
  onMoveRight,
  missingCount,
  onRemoveMissing,
  removeMissingDisabledReason = null,
  onDelete,
}: GroupMenuItemsProps) {
  const { t } = useTranslation();
  const Item = variant === 'dropdown' ? DropdownMenuItem : ContextMenuItem;
  const Separator = variant === 'dropdown' ? DropdownMenuSeparator : ContextMenuSeparator;
  return (
    <>
      <Item onSelect={onRename}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        {t('groups.menu.rename')}
      </Item>
      <Item onSelect={onChangeColor}>
        <Palette className="h-4 w-4" aria-hidden="true" />
        {t('groups.menu.color')}
      </Item>
      <Separator />
      <Item disabled={!canMoveLeft} onSelect={onMoveLeft}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('groups.menu.moveLeft')}
      </Item>
      <Item disabled={!canMoveRight} onSelect={onMoveRight}>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        {t('groups.menu.moveRight')}
      </Item>
      <Separator />
      {missingCount > 0 && (
        <Item
          disabled={removeMissingDisabledReason !== null}
          title={removeMissingDisabledReason ?? undefined}
          onSelect={onRemoveMissing}
        >
          <ListX className="h-4 w-4" aria-hidden="true" />
          {t('groups.menu.removeMissing', { count: missingCount })}
        </Item>
      )}
      <Item destructive onSelect={onDelete}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t('groups.menu.delete')}
      </Item>
    </>
  );
}
