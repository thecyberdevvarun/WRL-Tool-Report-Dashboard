import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { baseURL } from "../../assets/assets.js";

export const chemicalApi = createApi({
  reducerPath: "chemicalApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseURL, credentials: "include" }),
  endpoints: (builder) => ({

    // ── Reports & data ──────────────────────────────────────────────────────
    getChemCurrentLevels: builder.query({
      query: () => "chemical/tanks/current",
      transformResponse: (res) => res.data ?? [],
    }),
    getChemDailyReport: builder.query({
      query: ({ startDate, endDate }) => ({ url: "chemical/reports/daily", params: { startDate, endDate } }),
      transformResponse: (res) => res.data ?? { rows: [], summary: {} },
    }),
    getChemReadings: builder.query({
      query: (params) => ({ url: "chemical/readings", params }),
      transformResponse: (res) => ({ rows: res.data ?? [], meta: res.meta ?? {} }),
    }),
  }),
});

export const {
  useGetChemCurrentLevelsQuery,
  useGetChemDailyReportQuery,
  useGetChemReadingsQuery,
} = chemicalApi;
