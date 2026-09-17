-- `de_paginas.indexable` significa UNA cosa: si la etiqueta robots de la página
-- permite indexarla. Es una propiedad de la página.
--
-- Hoy la sobrecargué para significar también «ya no está en el sitemap», y el
-- resultado fue inmediato: la regla `noindex_en_sitemap` empezó a acusar de
-- estar-en-el-sitemap-con-noindex a páginas que precisamente habían SALIDO del
-- sitemap. Siete hallazgos de severidad alta diciendo exactamente lo contrario
-- de la verdad.
--
-- La lección es sobre modelado, no sobre el bug: un campo que significa dos
-- cosas acaba mintiendo sobre las dos. Se separa.
--
-- `en_sitemap` arranca en true para todo lo conocido, que es como estaba antes
-- de que nada saliera.

alter table de_paginas add column if not exists en_sitemap boolean not null default true;

comment on column de_paginas.en_sitemap is
  'Si la URL seguía en el sitemap en el último rastreo. Distinto de `indexable`, que es lo que dice la etiqueta robots de la página: una puede salir del sitemap y seguir permitiendo indexación, y al revés.';

-- Se deshace la sobrecarga: las que marqué indexable=false por haber salido del
-- sitemap vuelven a su valor real y se marcan en la columna que toca.
update de_paginas set en_sitemap = false, indexable = true
 where url in ('https://www.sacscloud.com/app/dashboard/',
               'https://www.sacscloud.com/app/inbox/',
               'https://www.sacscloud.com/nosotros/',
               'https://www.sacscloud.com/manifiesto/',
               'https://www.sacscloud.com/registro/',
               'https://www.sacscloud.com/bienvenida/',
               'https://www.sacscloud.com/prueba-gratis/');
