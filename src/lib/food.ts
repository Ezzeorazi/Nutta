/** Un alimento con sus valores nutricionales por 100 g (o 100 ml). */
export type FoodProduct = {
  id: string;
  name: string;
  brand: string | null;
  /** valores nutricionales por 100 g */
  per100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};
