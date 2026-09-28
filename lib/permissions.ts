import type { Profile } from '@/lib/types';
import type { View } from '@/components/RouterContext';

const MANAGER_ONLY_VIEWS: View['name'][] = [
  'merchants',
  'employees',
  'accounts',
  'activities',
  'activity-trends',
  'alerts',
  'alerts-archive',
  'backup',
];

export function canAccessView(profile: Profile, view: View): boolean {
  return profile.role === 'manager' || !MANAGER_ONLY_VIEWS.includes(view.name);
}

/** صلاحية الإضافة والتعديل: المدير يملكها دائماً، وغيره بحسب علم can_edit. */
export function canEdit(profile: Profile): boolean {
  return profile.role === 'manager' || profile.canEdit;
}

export function canDelete(profile: Profile): boolean {
  return profile.role === 'manager' || profile.canDelete;
}
