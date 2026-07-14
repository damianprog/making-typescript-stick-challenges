import fetch from "node-fetch";

class FunctionableElement {
  element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  html(text: string) {
    this.element.innerText = text;
  }

  show() {
    this.element.style.visibility = "visible";
  }

  on(eventName: string, callback: (...args: any[]) => void) {
    this.element.addEventListener(eventName, callback);
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
  export async function ajax(ajaxProps: AjaxProps): void {
    const response = await fetch(ajaxProps.url);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result: ResponseData = await response.json();
  }
}

export default $;
