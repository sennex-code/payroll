import {
  MutationFunction,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

export const mutationHandler = async (
  promise: Promise<any>,
  errorMsg?: string,
) => {
  try {
    const res = await promise;

    return res.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      errorMsg ||
      error.message ||
      "Something went wrong";

    throw new Error(errorMessage);
  }
};

type CreateMutationProps<Tdata, Tvariables> = {
  mutationFn: MutationFunction<Tdata, Tvariables>; // Tdata is return type, Tvariables is data type
  successMsg: string;
  invalidateKeys: string[];
  showToast: (message: any, type?: string, duration?: number) => void;
  successExtra?: () => void;
  callback?: (data: Tdata, variables: Tvariables) => Promise<void>;
};

export const createMutation = <Tdata, Tvariables>({
  mutationFn,
  successMsg,
  showToast,
  invalidateKeys = [],

  successExtra,
  callback,
}: CreateMutationProps<Tdata, Tvariables>) => {
  const qr = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      // for emailCallback
      if (callback) {
        await callback(data, variables);
        try {
        } catch (e) {
          console.error("Email notification failed:", e);
        }
      }

      await Promise.all(
        invalidateKeys.map((key, index) =>
          qr.invalidateQueries({ queryKey: [key] }),
        ),
      );
      showToast(successMsg);

      successExtra?.();
    },
    onError: (err) => {
      showToast(err.message || "Sometwhing went wrong", "error");
    },
  });
};
