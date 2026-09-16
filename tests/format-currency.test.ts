import { describe, expect, it } from "vitest"
import { formatMinorCurrency } from "../packages/ui/src/lib/format-currency"

describe("formatMinorCurrency", () => {
    it("formats zero and normal currencies", () => {
        expect(formatMinorCurrency(0)).toBe("MMK 0")
        expect(formatMinorCurrency(12345, "USD")).toBe("$123")
        expect(formatMinorCurrency(12345, "EUR")).toBe("€123")
    })
    it("normalizes and safely falls back currency codes", () => {
        expect(formatMinorCurrency(12345, " usd ")).toBe("$123")
        expect(formatMinorCurrency(12345)).toBe("MMK 123")
        expect(formatMinorCurrency(12345, "US")).toBe("MMK 123")
        expect(formatMinorCurrency(12345, "QAA")).toBe("MMK 123")
    })
    it("clamps invalid minor values without throwing", () => {
        expect(() => formatMinorCurrency(NaN, "USD")).not.toThrow()
        expect(formatMinorCurrency(NaN, "USD")).toBe("$0")
        expect(formatMinorCurrency(Infinity, "USD")).toBe("$0")
        expect(formatMinorCurrency(-100, "USD")).toBe("$0")
    })
})
