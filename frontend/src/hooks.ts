import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Status } from "./api";

export function useBrands() {
  return useQuery({ queryKey: ["brands"], queryFn: api.brands, staleTime: 60_000 });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: api.settings });
}

/** Name of the reference brand ("Citadel" by default) for column headers. */
export function useReferenceBrandName(): string {
  const brands = useBrands().data;
  const settings = useSettings().data;
  return brands?.find((b) => b.slug === settings?.reference_brand)?.name ?? "Citadel";
}

/** Any change to the collection invalidates every list that shows ownership. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useAddToInventory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (vars: { paint_id: number; status?: Status }) => api.addToInventory(vars),
    onSuccess: invalidate,
  });
}

export function useUpdateInventory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (vars: { id: number; quantity?: number; status?: Status; tags?: string[]; note?: string }) => {
      const { id, ...body } = vars;
      return api.updateInventory(id, body);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveFromInventory() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.removeFromInventory(id), onSuccess: invalidate });
}
