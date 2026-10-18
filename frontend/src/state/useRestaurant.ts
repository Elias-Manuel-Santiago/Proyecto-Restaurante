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
