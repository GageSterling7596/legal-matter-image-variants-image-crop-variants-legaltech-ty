export type FollowUp = "routine" | "due_soon" | "overdue";

export type MatterIntake = {
  matterId: string;
  matterType: "contract" | "litigation" | "property";
  evidenceImage: string;
  signedDocument: {
    objectKey: string;
    contentType: "application/pdf";
  };
  deadline: string;
};

export type CropVariant = {
  label: "case_card" | "timeline" | "document_preview";
  aspect: "4:3" | "16:9" | "3:4";
};

export type DeliveryPlan = {
  followUp: FollowUp;
  variants: CropVariant[];
};

const variants: CropVariant[] = [
  { label: "case_card", aspect: "4:3" },
  { label: "timeline", aspect: "16:9" },
  { label: "document_preview", aspect: "3:4" }
];

export function planLegalDelivery(deadline: string, now: Date): DeliveryPlan {
  const deadlineAt = new Date(`${deadline}T23:59:59.999Z`).getTime();
  const remainingDays = (deadlineAt - now.getTime()) / 86_400_000;
  const followUp: FollowUp = remainingDays < 0
    ? "overdue"
    : remainingDays <= 3
      ? "due_soon"
      : "routine";

  return { followUp, variants: variants.map((variant) => ({ ...variant })) };
}

export async function createMatterImageVariants<T>(
  image: string,
  crop: (image: string, aspect: CropVariant["aspect"]) => Promise<T>
): Promise<Array<CropVariant & { image: T }>> {
  return Promise.all(variants.map(async (variant) => ({
    ...variant,
    image: await crop(image, variant.aspect)
  })));
}
