-- Remove a tabela de bairros.
--
-- Ela guardava 16 bairros de Manaus com coordenadas escritas à mão. Nada sobre
-- endereço fica mais fixo no código: o bairro vem do CEP (BrasilAPI) e a
-- coordenada vem do mapa (Nominatim), com cache em `enderecos_geocodificados`.
DROP TABLE IF EXISTS "bairros";
