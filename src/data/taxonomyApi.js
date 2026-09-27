

import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'

let cache = null

export async function fetchTaxonomy() {
  const cats = await apiGet('/taxonomy')
  cache = [...cats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return cache
}

export const createCategory = (dto) => apiPost('/taxonomy', dto)
export const updateCategory = (id, dto) => apiPatch(`/taxonomy/${id}`, dto)
export const deleteCategory = (id) => apiDelete(`/taxonomy/${id}`)

export async function fetchCategoryNames() {
  return (await fetchTaxonomy()).map(c => c.name)
}

export const cachedTaxonomy = () => cache || []
