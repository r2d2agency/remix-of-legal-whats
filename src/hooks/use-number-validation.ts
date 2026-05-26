import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface ValidationStatus {
  total: number;
  processed: number;
  valid: number;
  invalid: number;
  currentPhone: string;
  isComplete: boolean;
  error?: string;
}

export function useNumberValidation() {
  const [status, setStatus] = useState<ValidationStatus | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateList = async (listId: string, connectionId: string, phones: string[]) => {
    setIsValidating(true);
    const total = phones.length;
    setStatus({
      total,
      processed: 0,
      valid: 0,
      invalid: 0,
      currentPhone: "",
      isComplete: false,
    });

    const results: { phone: string; exists: boolean }[] = [];
    
    // Process in smaller batches for real-time feel if needed, 
    // but here we do it number by number or small groups to show progress
    const batchSize = 1; 
    
    try {
      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize);
        setStatus(prev => prev ? { ...prev, currentPhone: batch[0] } : null);

        const response = await api<{ success: boolean; results: { phone: string; exists: boolean }[] }>(
          `/api/uazapi/${connectionId}/validate-numbers`,
          {
            method: 'POST',
            body: { phones: batch }
          }
        );

        if (response.success && response.results) {
          results.push(...response.results);
          const validInBatch = response.results.filter(r => r.exists).length;
          const invalidInBatch = response.results.length - validInBatch;

          setStatus(prev => {
            if (!prev) return null;
            return {
              ...prev,
              processed: prev.processed + response.results.length,
              valid: prev.valid + validInBatch,
              invalid: prev.invalid + invalidInBatch,
            };
          });
        } else {
          // Se falhar o lote, marcamos como inválido
          setStatus(prev => {
            if (!prev) return null;
            return {
              ...prev,
              processed: prev.processed + batch.length,
              invalid: prev.invalid + batch.length,
            };
          });
        }

        // Aguarda um pequeno intervalo entre cada validação para evitar bloqueios e garantir precisão
        // Especialmente importante para listas grandes conforme solicitado pelo usuário
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Final update to the DB
      await api(`/api/contacts/lists/${listId}/validate-bulk`, {
        method: 'POST',
        body: { results }
      });

      setStatus(prev => prev ? { ...prev, isComplete: true, currentPhone: "Concluído" } : null);
    } catch (err: any) {
      setStatus(prev => prev ? { ...prev, error: err.message || "Erro na validação" } : null);
    } finally {
      setIsValidating(false);
    }
  };

  return {
    status,
    isValidating,
    validateList,
    resetStatus: () => setStatus(null),
  };
}
