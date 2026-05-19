import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Contact, ContactAssignmentList } from '../types'

export const CONTACTS_QUERY_KEY = ['admin', 'contacts'] as const
export const CONTACT_ASSIGNMENTS_QUERY_KEY = ['admin', 'contact-assignments'] as const

export function contactsQueryOptions(agroUnitId?: string) {
  return queryOptions({
    queryKey: agroUnitId ? [...CONTACTS_QUERY_KEY, { agroUnitId }] : CONTACTS_QUERY_KEY,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/contacts/', {
        params: agroUnitId ? { query: { agro_unit: agroUnitId } as never } : undefined,
      })
      if (error) throw new Error('No se pudo cargar los contactos')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useContacts(agroUnitId?: string) {
  return useQuery(contactsQueryOptions(agroUnitId))
}

export function contactAssignmentsQueryOptions(agroUnitId?: string) {
  return queryOptions({
    queryKey: agroUnitId
      ? [...CONTACT_ASSIGNMENTS_QUERY_KEY, { agroUnitId }]
      : CONTACT_ASSIGNMENTS_QUERY_KEY,
    queryFn: async (): Promise<ContactAssignmentList[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/contacts/assignments/', {
        params: agroUnitId ? { query: { agro_unit: agroUnitId } as never } : undefined,
      })
      if (error) throw new Error('No se pudo cargar las asignaciones de contacto')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useContactAssignments(agroUnitId?: string) {
  return useQuery(contactAssignmentsQueryOptions(agroUnitId))
}

export function useCreateContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      address_line_1?: string
      address_line_2?: string
      phone?: string
      email?: string
    }) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/contacts/create/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY })
    },
  })
}

export function useCreateContactAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { contact_id: string; agro_unit_id: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/contacts/assign/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACT_ASSIGNMENTS_QUERY_KEY })
    },
  })
}

export function useDeleteContactAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assignmentId: number) => {
      const { error } = await apiClient.DELETE(
        '/api/v1/organizations/contacts/assignments/{id}/',
        { params: { path: { id: assignmentId } } },
      )
      if (error) throw new Error('No se pudo eliminar la asignación')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACT_ASSIGNMENTS_QUERY_KEY })
    },
  })
}
