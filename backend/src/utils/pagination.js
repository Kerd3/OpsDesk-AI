import { query as q } from 'express-validator';

export const paginationRules = [
  q('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  q('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export function getPagination(query, defaultSize = 20) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? defaultSize;
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

export function paginationMeta({ page, pageSize }, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Small helper for building parameterized WHERE clauses.
 * `add('status = ?', value)` replaces `?` with the next $n placeholder.
 */
export class SqlConditions {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  add(clause, ...values) {
    let text = clause;
    for (const value of values) {
      this.params.push(value);
      text = text.replace('?', `$${this.params.length}`);
    }
    this.clauses.push(text);
    return this;
  }

  /** Register a parameter without a clause and return its placeholder. */
  param(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  where() {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}
