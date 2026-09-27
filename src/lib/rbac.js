

import { getUsers, userPermissions, defaultPermissions } from '../data/users'

export function currentPermissions(view) {
  const me = getUsers().find(u => u.name === view?.name)
  return me ? userPermissions(me) : defaultPermissions(view?.role)
}

export const canAccess = (view, moduleKey) => currentPermissions(view).includes(moduleKey)
