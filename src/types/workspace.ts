/** DataCentralMain (CIAgro Padre) — GET /organizations/data-centrals-main/ */
export interface DataCentralMain {
  id: string
  name: string
  slug: string
  status: string
  is_owner: boolean
  created_at: string
}

/** DataCentral (CIAgro Hija) — GET /organizations/datacentrals/ */
export interface DataCentral {
  id: string
  name: string
  slug: string
  data_central_main: { id: string; name: string }
  is_primary: boolean
  is_owner: boolean
  description: string
  created_at: string
}
