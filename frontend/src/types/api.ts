export interface ApiSuccess<Data, Meta = undefined> {
  success: true
  message: string
  data: Data
  meta: Meta
}

export interface PageMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
