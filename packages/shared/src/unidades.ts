/**
 * Unidade de venda: o CÓDIGO e o RÓTULO são coisas diferentes.
 *
 * No banco e na API a unidade é um código sem acento (`maco`), porque valor de
 * enum viaja em URL, exportação e integração — e cedilha ali é fonte de dor.
 * O "maço" que a pessoa lê existe só aqui.
 */

export const UNIDADES = ['kg', 'un', 'maco', 'bandeja', 'cartela'] as const

export type Unidade = (typeof UNIDADES)[number]
