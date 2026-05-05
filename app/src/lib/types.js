/**
 * @typedef {'daily'|'weekly'|'monthly'} RecurrenceFreq
 *
 * @typedef {{ freq: RecurrenceFreq, days: number[] }} RecurrenceRule
 *
 * @typedef {{ text: string, since: string }} WaitingOn
 *
 * @typedef {{ id: string, text: string, done: boolean, due_date?: string|null }} Subtask
 *
 * @typedef {{
 *   id: string,
 *   user_id?: string,
 *   board_id: string,
 *   template_id?: string|null,
 *   title: string,
 *   notes: string,
 *   column: 'todo'|'progress'|'done',
 *   due_date: string|null,
 *   subtasks: Subtask[],
 *   waiting_on: WaitingOn|null,
 *   created_at?: string,
 *   completed_at?: string|null,
 *   updated_at?: string,
 *   device_id?: string|null,
 *   recurrence?: RecurrenceRule|null,
 * }} Card
 *
 * @typedef {{
 *   id: string,
 *   user_id?: string,
 *   parent_id?: string|null,
 *   name: string,
 *   color: string,
 *   sort_order?: number,
 *   archived: boolean,
 *   updated_at?: string,
 * }} Board
 *
 * @typedef {{
 *   id: string,
 *   user_id?: string,
 *   board_id: string,
 *   title: string,
 *   notes: string,
 *   recurrence_rule: RecurrenceRule|null,
 *   subtasks_template: Omit<Subtask,'done'>[],
 *   updated_at?: string,
 * }} Template
 */

export {};
