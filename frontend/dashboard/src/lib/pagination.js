import { useState, useEffect } from "react";

export const TAILLE_PAGE = 17;

/**
 * Pagination client : découpe une liste en pages de `pageSize` éléments
 * (17 par défaut) et recentre la page courante si la liste rétrécit
 * (filtre, recherche, rechargement…).
 */
export function usePagination(elements, pageSize = TAILLE_PAGE) {
  const total = Array.isArray(elements) ? elements.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const debut = (page - 1) * pageSize;
  const elementsPage = Array.isArray(elements)
    ? elements.slice(debut, debut + pageSize)
    : [];

  return { page, totalPages, setPage, elementsPage };
}