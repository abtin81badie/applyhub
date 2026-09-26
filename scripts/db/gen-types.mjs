#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Generates src/lib/database.types.ts from a migrated database, in the same
// shape as `supabase gen types typescript` (Tables/Views/Functions/Enums,
// Relationships for typed embedding, and a Constants object with enum values).
//
// Usage: DATABASE_URL=postgresql://... node scripts/db/gen-types.mjs [out-file]
// `npm run db:types` starts a temporary database with all migrations applied.
// With the Supabase CLI you can instead run:
//   supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
// -----------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const outFile = resolve(process.argv[2] ?? 'src/lib/database.types.ts');
const SCHEMA = 'public';

const query = String.raw`
with rels as (
  select c.oid, c.relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = '${SCHEMA}' and c.relkind in ('r', 'p', 'v', 'm')
),
cols as (
  select r.relname, a.attnum, a.attname, t.typname, t.typtype, t.typcategory,
         tn.nspname as type_schema, et.typname as elem_typname, et.typtype as elem_typtype,
         a.attnotnull, a.atthasdef, a.attidentity, a.attgenerated
  from rels r
  join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  join pg_type t on t.oid = a.atttypid
  join pg_namespace tn on tn.oid = t.typnamespace
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
),
fks as (
  select con.conname, cl.relname as tbl, rcl.relname as ref_tbl, rn.nspname as ref_schema,
         array_agg(att.attname order by k.ord) as columns,
         array_agg(ratt.attname order by k.ord) as ref_columns,
         con.conrelid, con.conkey
  from pg_constraint con
  join pg_class cl on cl.oid = con.conrelid
  join pg_namespace n on n.oid = cl.relnamespace
  join pg_class rcl on rcl.oid = con.confrelid
  join pg_namespace rn on rn.oid = rcl.relnamespace
  cross join lateral unnest(con.conkey, con.confkey) with ordinality as k(attnum, refattnum, ord)
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
  join pg_attribute ratt on ratt.attrelid = con.confrelid and ratt.attnum = k.refattnum
  where con.contype = 'f' and n.nspname = '${SCHEMA}'
  group by con.conname, cl.relname, rcl.relname, rn.nspname, con.conrelid, con.conkey
),
uniq as (
  select i.indrelid, i.indkey::int2[] as cols
  from pg_index i where i.indisunique
),
enums as (
  select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = '${SCHEMA}'
  group by t.typname
),
funcs as (
  select p.oid, p.proname, p.proretset, p.pronargs, p.pronargdefaults,
         rt.typname as ret_typname, rt.typtype as ret_typtype, rt.typrelid as ret_relid,
         ret.typname as ret_elem_typname,
         rtn.nspname as ret_type_schema,
         coalesce(p.proargnames, '{}') as argnames,
         coalesce(p.proargmodes::text[], array_fill('i'::text, array[p.pronargs])) as argmodes,
         coalesce(p.proallargtypes, p.proargtypes::oid[]) as argtypes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  join pg_namespace rtn on rtn.oid = rt.typnamespace
  left join pg_type ret on ret.oid = rt.typelem and rt.typcategory = 'A'
  where n.nspname = '${SCHEMA}' and p.prokind = 'f' and rt.typname <> 'trigger'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
func_args as (
  select f.oid, a.ord, a.name, a.mode, t.typname, t.typtype, t.typcategory,
         et.typname as elem_typname, et.typtype as elem_typtype
  from funcs f
  cross join lateral unnest(f.argnames, f.argmodes, f.argtypes) with ordinality as a(name, mode, typ, ord)
  join pg_type t on t.oid = a.typ
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
)
select json_build_object(
  'relations', (select json_agg(json_build_object('name', relname, 'kind', relkind) order by relname) from rels),
  'columns', (select json_agg(row_to_json(cols) order by relname, attnum) from cols),
  'fks', (select json_agg(json_build_object(
            'name', f.conname, 'table', f.tbl, 'refTable', f.ref_tbl, 'refSchema', f.ref_schema,
            'columns', f.columns, 'refColumns', f.ref_columns,
            'oneToOne', exists (select 1 from uniq u where u.indrelid = f.conrelid
                                 and u.cols @> f.conkey and u.cols <@ f.conkey))
          order by f.tbl, f.conname) from fks f),
  'enums', (select json_agg(json_build_object('name', typname, 'labels', labels) order by typname) from enums),
  'functions', (select json_agg(json_build_object(
                  'name', f.proname, 'retset', f.proretset, 'nargs', f.pronargs,
                  'ndefaults', f.pronargdefaults, 'retType', f.ret_typname, 'retTypType', f.ret_typtype,
                  'retRelid', f.ret_relid, 'retElem', f.ret_elem_typname, 'retTypeSchema', f.ret_type_schema,
                  'args', (select json_agg(row_to_json(fa) order by fa.ord) from func_args fa where fa.oid = f.oid))
                order by f.proname, f.oid) from funcs f),
  'relidNames', (select json_object_agg(oid::text, relname) from rels)
);
`;

const raw = execFileSync('psql', ['-X', '-At', '-v', 'ON_ERROR_STOP=1', url, '-c', query], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const meta = JSON.parse(raw);

const enumNames = new Set((meta.enums ?? []).map((e) => e.name));

function scalarType(typname, typtype) {
  if (typtype === 'e' || enumNames.has(typname))
    return `Database["${SCHEMA}"]["Enums"]["${typname}"]`;
  switch (typname) {
    case 'bool':
      return 'boolean';
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
    case 'oid':
      return 'number';
    case 'json':
    case 'jsonb':
      return 'Json';
    case 'void':
      return 'undefined';
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'uuid':
    case 'date':
    case 'time':
    case 'timetz':
    case 'timestamp':
    case 'timestamptz':
    case 'interval':
    case 'citext':
    case 'inet':
    case 'bytea':
    case 'name':
      return 'string';
    case 'record':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function pgType(col) {
  if (col.typcategory === 'A' && col.elem_typname) {
    return `${scalarType(col.elem_typname, col.elem_typtype)}[]`;
  }
  return scalarType(col.typname, col.typtype);
}

const columnsByRel = new Map();
for (const c of meta.columns ?? []) {
  if (!columnsByRel.has(c.relname)) columnsByRel.set(c.relname, []);
  columnsByRel.get(c.relname).push(c);
}

const fksByTable = new Map();
for (const fk of meta.fks ?? []) {
  if (fk.refSchema !== SCHEMA) continue;
  if (!fksByTable.has(fk.table)) fksByTable.set(fk.table, []);
  fksByTable.get(fk.table).push(fk);
}

const q = (s) => JSON.stringify(s);
const indent = (n) => '  '.repeat(n);

function rowBlock(cols, isView, depth) {
  return cols
    .map((c) => {
      const nullable = isView || !c.attnotnull;
      return `${indent(depth)}${c.attname}: ${pgType(c)}${nullable ? ' | null' : ''}`;
    })
    .join('\n');
}

function insertBlock(cols, depth) {
  return cols
    .map((c) => {
      if (c.attidentity === 'a' || c.attgenerated === 's')
        return `${indent(depth)}${c.attname}?: never`;
      const optional = !c.attnotnull || c.atthasdef || c.attidentity === 'd';
      return `${indent(depth)}${c.attname}${optional ? '?' : ''}: ${pgType(c)}${!c.attnotnull ? ' | null' : ''}`;
    })
    .join('\n');
}

function updateBlock(cols, depth) {
  return cols
    .map((c) => {
      if (c.attidentity === 'a' || c.attgenerated === 's')
        return `${indent(depth)}${c.attname}?: never`;
      return `${indent(depth)}${c.attname}?: ${pgType(c)}${!c.attnotnull ? ' | null' : ''}`;
    })
    .join('\n');
}

function relationshipsBlock(table, depth) {
  const fks = fksByTable.get(table) ?? [];
  if (fks.length === 0) return `${indent(depth)}Relationships: []`;
  const items = fks
    .map(
      (fk) => `${indent(depth + 1)}{
${indent(depth + 2)}foreignKeyName: ${q(fk.name)}
${indent(depth + 2)}columns: [${fk.columns.map(q).join(', ')}]
${indent(depth + 2)}isOneToOne: ${fk.oneToOne}
${indent(depth + 2)}referencedRelation: ${q(fk.refTable)}
${indent(depth + 2)}referencedColumns: [${fk.refColumns.map(q).join(', ')}]
${indent(depth + 1)}},`,
    )
    .join('\n');
  return `${indent(depth)}Relationships: [\n${items}\n${indent(depth)}]`;
}

const tables = (meta.relations ?? []).filter((r) => r.kind === 'r' || r.kind === 'p');
const views = (meta.relations ?? []).filter((r) => r.kind === 'v' || r.kind === 'm');

const tablesTs = tables
  .map((t) => {
    const cols = columnsByRel.get(t.name) ?? [];
    return `${indent(3)}${t.name}: {
${indent(4)}Row: {
${rowBlock(cols, false, 5)}
${indent(4)}}
${indent(4)}Insert: {
${insertBlock(cols, 5)}
${indent(4)}}
${indent(4)}Update: {
${updateBlock(cols, 5)}
${indent(4)}}
${relationshipsBlock(t.name, 4)}
${indent(3)}}`;
  })
  .join('\n');

const viewsTs = views
  .map((v) => {
    const cols = columnsByRel.get(v.name) ?? [];
    return `${indent(3)}${v.name}: {
${indent(4)}Row: {
${rowBlock(cols, true, 5)}
${indent(4)}}
${indent(4)}Relationships: []
${indent(3)}}`;
  })
  .join('\n');

function objectFromCols(cols, depth, allNullable) {
  return `{\n${cols
    .map(
      (c) =>
        `${indent(depth + 1)}${c.attname}: ${pgType(c)}${allNullable || !c.attnotnull ? ' | null' : ''}`,
    )
    .join('\n')}\n${indent(depth)}}`;
}

function functionTs(f, depth) {
  const args = f.args ?? [];
  const inputs = args.filter((a) => a.mode === 'i' || a.mode === 'b' || a.mode === 'v');
  const outputs = args.filter((a) => a.mode === 'o' || a.mode === 'b' || a.mode === 't');
  const firstOptional = inputs.length - (f.ndefaults ?? 0);
  const argsTs =
    inputs.length === 0
      ? 'never'
      : `{ ${inputs
          .map((a, i) => `${a.name}${i >= firstOptional ? '?' : ''}: ${pgType(a)}`)
          .join('; ')} }`;

  let ret;
  if (outputs.length > 0) {
    const obj = `{\n${outputs
      .map((a) => `${indent(depth + 2)}${a.name}: ${pgType(a)} | null`)
      .join('\n')}\n${indent(depth + 1)}}`;
    ret = f.retset ? `${obj}[]` : obj;
  } else if (f.retTypType === 'c' && f.retRelid) {
    const relName = meta.relidNames?.[String(f.retRelid)];
    const cols = relName ? (columnsByRel.get(relName) ?? []) : [];
    const obj = objectFromCols(cols, depth + 1, false);
    ret = f.retset ? `${obj}[]` : obj;
  } else {
    const base =
      f.retElem != null ? `${scalarType(f.retElem)}[]` : scalarType(f.retType, f.retTypType);
    ret = f.retset ? `${base}[]` : base;
  }
  return `${indent(depth)}Args: ${argsTs}\n${indent(depth)}Returns: ${ret}`;
}

// Overloaded functions become a union of signatures (same as the Supabase CLI).
const fnByName = new Map();
for (const f of meta.functions ?? []) {
  if (!fnByName.has(f.name)) fnByName.set(f.name, []);
  fnByName.get(f.name).push(f);
}
const functionsTs = [...fnByName.entries()]
  .map(([name, overloads]) => {
    if (overloads.length === 1) {
      return `${indent(3)}${name}: {\n${functionTs(overloads[0], 4)}\n${indent(3)}}`;
    }
    return `${indent(3)}${name}:\n${overloads
      .map((f) => `${indent(4)}| {\n${functionTs(f, 5)}\n${indent(4)}}`)
      .join('\n')}`;
  })
  .join('\n');

const enumsTs = (meta.enums ?? [])
  .map((e) => `${indent(3)}${e.name}:\n${e.labels.map((l) => `${indent(4)}| ${q(l)}`).join('\n')}`)
  .join('\n');

const constantsTs = (meta.enums ?? [])
  .map((e) => `${indent(3)}${e.name}: [${e.labels.map(q).join(', ')}],`)
  .join('\n');

const output = `// This file is generated by scripts/db/gen-types.mjs from supabase/migrations.
// Do not edit by hand: run \`npm run db:types\` after changing a migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13"
  }
  ${SCHEMA}: {
    Tables: {
${tablesTs}
    }
    Views: {
${viewsTs || `${indent(3)}[_ in never]: never`}
    }
    Functions: {
${functionsTs || `${indent(3)}[_ in never]: never`}
    }
    Enums: {
${enumsTs || `${indent(3)}[_ in never]: never`}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "${SCHEMA}">]

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export type FunctionReturns<T extends keyof DefaultSchema["Functions"]> =
  DefaultSchema["Functions"][T] extends { Returns: infer R } ? R : never

export const Constants = {
  ${SCHEMA}: {
    Enums: {
${constantsTs}
    },
  },
} as const
`;

writeFileSync(outFile, output);
console.log(
  `Wrote ${outFile} (${tables.length} tables, ${views.length} views, ${fnByName.size} functions, ${enumNames.size} enums)`,
);
