import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const gasChargingApi = createApi({
  reducerPath: "gasChargingApi",
  baseQuery: fetchBaseQuery({
    baseUrl: baseURL,
    credentials: "include",
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth?.token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["GasCharging"],
  endpoints: (builder) => ({
    // Get Gas Charging Report
    getGasChargingReport: builder.query({
      query: (params) => ({
        url: "/gas-charging/report",
        params,
      }),
      providesTags: ["GasCharging"],
    }),

    // Get Models
    getGasChargingModels: builder.query({
      query: () => "/gas-charging/models",
    }),

    // Get Machines
    getGasChargingMachines: builder.query({
      query: () => "/gas-charging/machines",
    }),

    // Get Refrigerants
    getGasChargingRefrigerants: builder.query({
      query: () => "/gas-charging/refrigerants",
    }),

    // Export Data
    getGasChargingExport: builder.query({
      query: (params) => ({ url: "/gas-charging/export", params }),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetGasChargingReportQuery,
  useGetGasChargingModelsQuery,
  useGetGasChargingMachinesQuery,
  useGetGasChargingRefrigerantsQuery,
  useLazyGetGasChargingExportQuery,
} = gasChargingApi;
