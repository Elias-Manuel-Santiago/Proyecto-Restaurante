/**
 * Puente entre React y restaurantStore mediante useSyncExternalStore.
 * Cada emisión del store actualiza las pantallas suscritas; las acciones siguen delegándose al servidor.
 */
import { useSyncExternalStore } from 'react'
import { restaurantStore } from './store'

export function useRestaurant() {
  return {
    ...useSyncExternalStore(
      restaurantStore.subscribe,
      restaurantStore.getSnapshot,
    ),
    act: restaurantStore.act,
    actUser: restaurantStore.actUser,
  }
}
