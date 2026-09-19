alter table de_paginas add column if not exists avisada_at timestamptz;
comment on column de_paginas.avisada_at is 'Cuando se avisó a los buscadores (IndexNow) de esta URL. Si es null o anterior a updated_at, toca avisar. Evita reavisar el catálogo entero cada corrida, que es la unica forma de que los buscadores dejen de escucharnos.';
create index if not exists de_paginas_avisar_idx on de_paginas (avisada_at) where indexable;
