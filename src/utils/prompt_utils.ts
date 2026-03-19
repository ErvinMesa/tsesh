import {
  text as baseText,
  confirm as baseConfirm,
  select as baseSelect,
  autocomplete as baseAutocomplete,
  multiselect as baseMultiselect,
  cancel,
  isCancel,
  MultiSelectOptions,
  AutocompleteOptions,
  ConfirmOptions,
  SelectOptions,
  TextOptions
} from '@clack/prompts';

export const clearScreen = () => {
  process.stdout.write('\x1B[2J\x1B[H');
};

export const text = async (opts: TextOptions) => {
  const prompt = await baseText(opts);

  if (isCancel(prompt)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  return prompt.trim() || opts.defaultValue || ''
}

export const confirm = async (opts: ConfirmOptions) => {
  const prompt = await baseConfirm(opts);

  if (isCancel(prompt)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  return prompt;
};

export const select = async <T>(opts: SelectOptions<T>) => {
  const prompt = await baseSelect(opts);

  if (isCancel(prompt)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  return prompt
}

export const autocomplete = async <T>(opts: AutocompleteOptions<T>): Promise<T> => {
  const prompt = await baseAutocomplete(opts);

  if (isCancel(prompt)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  return prompt as T
};

export const multiselect = async <T>(opts: MultiSelectOptions<T>) => {
  const prompt = await baseMultiselect(opts);

  if (isCancel(prompt)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  return prompt;
}
