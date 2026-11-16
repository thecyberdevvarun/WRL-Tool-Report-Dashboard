import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const mailManagementApi = createApi({
  reducerPath: "mailManagementApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1/mail-management",
    credentials: "include",
  }),
  tagTypes: ["MailRecipient"],
  endpoints: (builder) => ({
    getMailTasks: builder.query({
      query: () => "/tasks",
      transformResponse: (res) => res.data ?? [],
    }),
    getMailRecipients: builder.query({
      query: () => "/recipients",
      transformResponse: (res) => res.data ?? [],
      providesTags: ["MailRecipient"],
    }),
    addMailRecipient: builder.mutation({
      query: (body) => ({ url: "/recipients", method: "POST", body }),
      invalidatesTags: ["MailRecipient"],
    }),
    updateMailRecipient: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/recipients/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["MailRecipient"],
    }),
    deleteMailRecipient: builder.mutation({
      query: (id) => ({ url: `/recipients/${id}`, method: "DELETE" }),
      invalidatesTags: ["MailRecipient"],
    }),
    testMailRecipient: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/recipients/${id}/test`,
        method: "POST",
        body,
      }),
      transformResponse: (res) => res.data ?? [],
    }),
  }),
});

export const {
  useGetMailTasksQuery,
  useGetMailRecipientsQuery,
  useAddMailRecipientMutation,
  useUpdateMailRecipientMutation,
  useDeleteMailRecipientMutation,
  useTestMailRecipientMutation,
} = mailManagementApi;
