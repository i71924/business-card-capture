export type SortBy = 'newest' | 'company';

export interface CardFields {
  name: string;
  company: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  tags: string;
  notes: string;
}

export interface CardRecord extends CardFields {
  id: string;
  created_at: string;
  image_file_id: string;
  image_url: string;
  raw_json: string;
}

export interface SearchParams {
  q: string;
  company: string;
  tag: string;
  from: string;
  to: string;
  sort: SortBy;
}

export const EMPTY_FIELDS: CardFields = {
  name: '',
  company: '',
  title: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  tags: '',
  notes: ''
};
