export const IPC_CHANNELS = {
  // renderer → main (invoke)
  DEVICES_LIST: 'devices:list',
  DEVICES_CONNECT: 'devices:connect',
  DEVICES_DISCONNECT: 'devices:disconnect',
  PROFILES_LIST: 'profiles:list',
  PROFILES_SAVE: 'profiles:save',
  PROFILES_DELETE: 'profiles:delete',
  PROFILES_SET_ACTIVE: 'profiles:setActive',
  MAPPING_SET_ENABLED: 'mapping:setEnabled',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  UPDATER_CHECK_NOW: 'updater:checkNow',
  UPDATER_INSTALL: 'updater:install',
  SHOW_SAVE_DIALOG: 'dialog:showSave',
  SHOW_OPEN_DIALOG: 'dialog:showOpen',
  // main → renderer (send)
  DEVICES_CHANGED: 'devices:changed',
  INPUT_EVENT: 'input:event',
  MAPPING_STATE_CHANGED: 'mapping:stateChanged',
  PROFILE_ACTIVATED: 'profile:activated',
  UPDATER_STATUS: 'updater:status',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
