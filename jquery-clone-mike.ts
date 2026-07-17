class SelectorResult {
  #elements;
  constructor(elements: NodeListOf<Element>) {
    this.#elements = elements;
  }

  html(contents: string) {
    // iterate over everything we found
    this.#elements.forEach((elem) => {
      // set contents equal to string we were given
      elem.innerHTML = contents;
    });
  }

  on<K extends keyof ElementEventMap>(
    eventName: K,
    cb: (event: ElementEventMap[K]) => void,
  ) {
    this.#elements.forEach((elem) => {
      elem.addEventListener(eventName, cb);
    });
  }
  show() {
    throw new Error("Method not implemented.");
  }
}

function $(selector: string) {
  return new SelectorResult(document.querySelectorAll(selector));
}

namespace $ {
  export function ajax(...args: any[]): any {
    return {} as any;
  }
}

export default $;

$("button.continue").html("Next Step...");

const hiddenBox = $("#banner-message");
$("#button-container button").on("click", (event) => {
  hiddenBox.show();
});
