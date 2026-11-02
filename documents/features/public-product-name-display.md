# One product per name in public catalogue lists

Public catalogue lists select one eligible product for each name. Names are compared without letter case or repeated whitespace; model numbers, colours and capacities remain part of the name. Missing names remain separate records.

The representative has the highest positive numeric stock. Equal-stock groups use the most recent valid updatedAt value, then a stable record ID. Public visibility rules apply before selection, so inactive, disabled, deleted and Sara Care service records cannot suppress an eligible retail product. Zero-stock groups still expose one record. Stock quantities are never combined.

Selection runs before search/category/stock filters, pagination and counts. The same record appears across products, category and brand listings, suggestions, navigation counts, public campaigns, homepage merchandising, recently viewed lists, structured data, sitemap and feeds. Filtering on metadata from an unselected copy does not bring that copy back into public lists.

Curated and history lookups use catalogue: true (bulk) or ?catalogue=true (single lookup) to resolve stored references to the representative without rewriting the references. Normal direct product, cart, checkout and compare lookups retain their specific record IDs. Recommendations exclude other records with the viewed product's name. Browser list parsers also collapse repeated names in older cached lists.

Admin products retain every database record; One product per name is an optional display mode there. Exports retain their original scope.

The server selector reads only IDs, names, stock, update dates and legacy name fields, with an 8-second query budget and a 20,000-record ceiling. Oversize input fails explicitly rather than producing a partial selection. It writes no product fields, indexes, reports or selection state. Existing cache lifetimes still apply; live queries recompute representatives when inventory changes.

Validation: npm run test:product-name-display uses synthetic fixtures and does not contact a database. TypeScript: npx tsc --noEmit.
