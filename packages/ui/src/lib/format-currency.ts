export function formatMinorCurrency(minor: number, currency?: string): string {
    const normalized = currency?.trim().toUpperCase()
    const isSupported = normalized && /^[A-Z]{3}$/.test(normalized) &&
        (typeof Intl.supportedValuesOf !== "function" || Intl.supportedValuesOf("currency").includes(normalized))
    const safeCurrency = isSupported ? normalized : "MMK"
    const safeMinor = Number.isFinite(minor) ? Math.max(0, minor) : 0
    try {
        return new Intl.NumberFormat("en-MM", {
            style: "currency",
            currency: safeCurrency,
            maximumFractionDigits: 0,
        }).format(safeMinor / 100)
    } catch {
        return new Intl.NumberFormat("en-MM", {
            style: "currency",
            currency: "MMK",
            maximumFractionDigits: 0,
        }).format(safeMinor / 100)
    }
}
