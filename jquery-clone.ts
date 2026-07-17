class FunctionableElement {
  #element: HTMLElement;

  constructor(element: HTMLElement) {
    this.#element = element;
  }

  html(text: string): this {
    this.#element.innerHTML = text;
    return this;
  }

  show(): this {
    this.#element.style.visibility = "visible";
    return this;
  }

  on(eventName: string, callback: (event: Event) => void): this {
    this.#element.addEventListener(eventName, callback);
    return this;
  }
}

function $(selector: string): FunctionableElement | null {
  const foundElement: HTMLElement | null = document.querySelector(selector);

  if (foundElement) {
    const funcElement = new FunctionableElement(foundElement);

    return funcElement;
  }

  return null;
}

interface ResponseData {
  title: string;
  body: string;
}

interface AjaxProps {
  url: string;
  success: (result: ResponseData) => void;
}

namespace $ {
  export async function ajax(ajaxProps: AjaxProps): Promise<void> {
    const response = await fetch(ajaxProps.url);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result: ResponseData = await response.json();

    ajaxProps.success(result);
  }
}

export default $;
