import { LocalStore } from "./store";

export const useShopId = () => {
  return LocalStore.getShop().shop_id;
};

export const getActiveShop = () => {
  return LocalStore.getShop();
};
