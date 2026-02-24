import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { baseURL } from "../../assets/assets.js";

export const fpaReportApi = createApi({
  reducerPath: "fpaReportApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${baseURL}quality` }),
  tagTypes: ["FpaHistory", "FpaModel", "FpaDefects"],

  endpoints: (builder) => ({
    // Query 1 — FPA Dashboard History
    getFpaHistory: builder.query({
      query: ({ startDate, endDate }) => ({
        url: "/history",
        params: { startDate, endDate },
      }),
      providesTags: ["FpaHistory"],
    }),

    // Query 2 — Model wise FGSRNo details
    getFpaByModel: builder.query({
      query: ({ model, startDate, endDate }) => ({
        url: `/model/${encodeURIComponent(model)}`,
        params: { startDate, endDate },
      }),
      providesTags: ["FpaModel"],
    }),

    // Query 3 — Defect details by FGSRNo
    getFpaDefectDetails: builder.query({
      query: ({ fgsrNo }) => ({
        url: `/defects/${fgsrNo}`,
      }),
      providesTags: ["FpaDefects"],
    }),
  }),
});

export const {
  useGetFpaHistoryQuery,
  useLazyGetFpaByModelQuery,
  useLazyGetFpaDefectDetailsQuery,
} = fpaReportApi;
