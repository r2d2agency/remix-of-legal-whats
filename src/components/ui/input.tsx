import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, spellCheck, lang, ...props }, ref) => {
    // Habilita corretor ortográfico nativo do navegador por padrão (pt-BR),
    // exceto em tipos onde não faz sentido (senha, email, número, url, busca, etc).
    const noSpellTypes = ["password", "email", "number", "url", "search", "tel"];
    const defaultSpell = type && noSpellTypes.includes(type) ? false : true;
    return (
      <input
        type={type}
        spellCheck={spellCheck ?? defaultSpell}
        lang={lang ?? "pt-BR"}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
