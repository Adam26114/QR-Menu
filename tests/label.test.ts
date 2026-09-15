import { Label } from "../packages/ui/src/components/label"
import { expect, test } from "vitest"

test("renders a native label element with forwarded props", () => {
    const element = Label({
        htmlFor: "email",
        className: "custom-label",
        children: "Email",
    })

    expect(element.type).toBe("label")
    expect(element.props.htmlFor).toBe("email")
    expect(element.props["data-slot"]).toBe("label")
    expect(element.props.className).toContain("custom-label")
})
