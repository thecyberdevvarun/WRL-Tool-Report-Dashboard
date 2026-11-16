import {
  combineReducers,
  configureStore,
  isRejectedWithValue,
} from "@reduxjs/toolkit";
import { handleSessionExpired } from "../utils/authExpiry.js";
import authSlice from "./slices/authSlice.js";
import estReportSlice from "./slices/estReportSlice.js";
import gasChargingSlice from "./slices/gasChargingSlice.js";
import fpaReportReducer from "./slices/fpaReportSlice.js";
import permissionReducer from "./slices/permissionSlice.js";
import masterConfigReducer from "./slices/masterConfigSlice.js";

import { commonApi } from "./api/commonApi.js";
import { taskReminderApi } from "./api/taskReminder.js";
import { estReportApi } from "./api/estReportApi.js";
import { gasChargingApi } from "./api/gasChargingApi.js";
import { fpaReportApi } from "./api/fpaReportApi.js";
import { partProcessApi } from "./api/partProcessApi.js";
import { masterConfigApi } from "./api/masterConfigApi.js";
import { chemicalApi } from "./api/chemicalApi.js";
import { settingsApi } from "./api/settingsApi.js";
import { mailManagementApi } from "./api/mailManagementApi.js";

import {
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import { permissionApi } from "./api/permissionApi.js";

const _hasValue = (v) => v !== "" && v != null && parseFloat(v) > 0;

const migrations = {
  // v2: default noOfSheet and actualComponentsPerSheet to 1 for any material missing/empty/0
  2: (state) => ({
    ...state,
    masterConfig: {
      ...state.masterConfig,
      materials: (state.masterConfig?.materials ?? []).map((m) => ({
        ...m,
        noOfSheet: _hasValue(m.noOfSheet) ? m.noOfSheet : 1,
        actualComponentsPerSheet: _hasValue(m.actualComponentsPerSheet)
          ? m.actualComponentsPerSheet
          : 1,
      })),
    },
  }),
};

const persistConfig = {
  key: "root",
  version: 2,
  storage,
  migrate: createMigrate(migrations, { debug: false }),
  blacklist: [
    estReportApi.reducerPath,
    gasChargingApi.reducerPath,
    fpaReportApi.reducerPath,
    permissionApi.reducerPath,
    partProcessApi.reducerPath,
    masterConfigApi.reducerPath,
    chemicalApi.reducerPath,
    settingsApi.reducerPath,
    mailManagementApi.reducerPath,
  ],
};

// reducer
const rootReducer = combineReducers({
  auth: authSlice,
  estReport: estReportSlice,
  gasCharging: gasChargingSlice,
  fpaReport: fpaReportReducer,
  permissions: permissionReducer,

  masterConfig: masterConfigReducer,
  [commonApi.reducerPath]: commonApi.reducer,
  [taskReminderApi.reducerPath]: taskReminderApi.reducer,
  [estReportApi.reducerPath]: estReportApi.reducer,
  [gasChargingApi.reducerPath]: gasChargingApi.reducer,
  [fpaReportApi.reducerPath]: fpaReportApi.reducer,
  [permissionApi.reducerPath]: permissionApi.reducer,
  [partProcessApi.reducerPath]: partProcessApi.reducer,
  [masterConfigApi.reducerPath]: masterConfigApi.reducer,
  [chemicalApi.reducerPath]: chemicalApi.reducer,
  [settingsApi.reducerPath]: settingsApi.reducer,
  [mailManagementApi.reducerPath]: mailManagementApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Catches a 401 from ANY RTK Query slice — the other fetch path (raw axios,
// still used by many older pages) is covered by the equivalent interceptor
// in main.jsx. Both funnel into the same handleSessionExpired.
const authExpiryMiddleware =
  ({ dispatch }) =>
  (next) =>
  (action) => {
    if (isRejectedWithValue(action) && action.payload?.status === 401) {
      handleSessionExpired(dispatch, action.payload?.data);
    }
    return next(action);
  };

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      commonApi.middleware,
      taskReminderApi.middleware,
      estReportApi.middleware,
      gasChargingApi.middleware,
      fpaReportApi.middleware,
      permissionApi.middleware,
      partProcessApi.middleware,
      masterConfigApi.middleware,
      chemicalApi.middleware,
      settingsApi.middleware,
      authExpiryMiddleware,
      mailManagementApi.middleware,
    ),
});

export default store;
