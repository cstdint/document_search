"use strict"

function textSearch() {
	function wrapTextInTextNode(textNode, searchText, wrapBlank) {
		let textContent = textNode.textContent;
		let lowerTextContent = textContent.toLocaleLowerCase();
		let resNodes = [];
		let beginIndex = 0;
		while (true) {
			let index = lowerTextContent.indexOf(searchText, beginIndex);
			if (index === -1)
				break;
			
			let prevText = textContent.slice(beginIndex, index);
			if (prevText.length > 0)
				resNodes.push(document.createTextNode(prevText));
			
			let elem = wrapBlank.cloneNode(false);
			elem.textContent = textContent.slice(index, index + searchText.length);
			resNodes.push(elem);
			
			beginIndex = index + searchText.length;
		}
		if (beginIndex === 0)
			return resNodes;
		let prevText = textContent.slice(beginIndex);
		if (prevText.length > 0)
			resNodes.push(document.createTextNode(prevText));
		return resNodes;
	}
	function wrapTextNodes(elementNode, searchText, wrapBlank) {
		let childNodes = Array.from( elementNode.childNodes );
		for (let child of childNodes)
			switch (child.nodeType) {
				case Node.TEXT_NODE:
					let nodesArr = wrapTextInTextNode(child, searchText, wrapBlank);
					if (nodesArr.length === 0)
						break;
					let prev = child;
					for (let node of nodesArr) {
						prev.after(node);
						prev = node;
					}
					child.remove();
					break;
				case Node.ELEMENT_NODE:
					wrapTextNodes(child, searchText, wrapBlank);
					break;
			}
	}
	
	function unwrapTextNodes(elementNode, wrapBlank) {
		let wrappedNodes = elementNode.querySelectorAll("." + wrapBlank.className);
		for (let i = 0; i < wrappedNodes.length; ++i) {
			let prevNode = wrappedNodes[i].previousSibling;
			let nextNode = wrappedNodes[i].nextSibling;
			
			let textNode = document.createTextNode(wrappedNodes[i].textContent);
			wrappedNodes[i].replaceWith(textNode);
			
			if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
				prevNode.textContent += textNode.textContent;
				textNode.remove();
				textNode = prevNode;
			}
			if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
				textNode.textContent += nextNode.textContent;
				nextNode.remove();
			}
		}
	}
	
	//Функции для управления прокруткой страницы
	
	function scrollToFoundElement(foundElement, topOffset) {
		let elementRect = foundElement.getBoundingClientRect();
		let windowWidth  = document.documentElement.clientWidth;
		let windowHeight = document.documentElement.clientHeight;
		const borderShift = Math.floor(Math.min(20, windowWidth, windowHeight) * 0.5);
		
		let middleX = windowWidth  * 0.5;
		let middleY = (windowHeight - topOffset) * 0.5 + topOffset;
		if (middleY < 0)
			middleY = 0;
		
		let scrollX = 0, scrollY = 0;
		if (elementRect.left < middleX) {
			if (elementRect.left < borderShift)
				scrollX = elementRect.left - borderShift;
		} else {
			if (elementRect.right > windowWidth - borderShift)
				scrollX = elementRect.right - (windowWidth - borderShift);
		}
		if (elementRect.top < middleY) {
			if (elementRect.top < topOffset + borderShift)
				scrollY = elementRect.top - (topOffset + borderShift);
		} else {
			if (elementRect.bottom > windowHeight - borderShift)
				scrollY = elementRect.bottom - (windowHeight - borderShift);
		}
		window.scrollBy(scrollX, scrollY);
	}
	
	function getElementPositionInDocument(element) {
		let elementRect = element.getBoundingClientRect();
		return {
			left:   elementRect.left   + document.documentElement.scrollLeft,
			top:    elementRect.top    + document.documentElement.scrollTop,
		};
	}
	
	function elementPositionInDocumentToArrayPosition(elementsArray, elementPositionInDocument) {
		let arrayPosition = 0;
		let minY = Number.POSITIVE_INFINITY;
		let minX = Number.POSITIVE_INFINITY;
		let {left, top} = elementPositionInDocument;
		let documentScrollLeft = document.documentElement.scrollLeft;
		let documentScrollTop  = document.documentElement.scrollTop;
		
		for (let i = 0; i < elementsArray.length; ++i) {
			let elementRect = elementsArray[i].getBoundingClientRect();
			let x  = elementRect.left   + documentScrollLeft;
			let y  = elementRect.top    + documentScrollTop;
			let yb = elementRect.bottom + documentScrollTop;
			if (y < minY || y === minY && x < minX)
				if (y <= top && yb >= top && left <= x || y > top) {
					minY = y; minX = x; arrayPosition = i;
				}
		}
		return arrayPosition;
	}
	
	//Назначаем обработчики событий на элементы управления страницы
	
	const classNameFoundAll      = "found-all";  //Класс для подсвечивания всех результатов поиска
	const classNameFoundCurrent  = "found-current";  //Класс для подсвечивания текущего результата
	const wrapBlank              = document.createElement("span");  //Заготовка для оборачивания результатов поиска
	wrapBlank.className          = "found-result";  //Класс для идентификации результатов поиска.
	
	const searchBlock  = document.getElementById("search-block");
	const controlBlock = document.getElementById("control-block");
	
	const controlInputText      = document.getElementById("input-text");
	const controlButtonBegin    = document.getElementById("button-begin");
	const controlButtonPrevious = document.getElementById("button-previous");
	const controlButtonNext     = document.getElementById("button-next");
	const controlCheckboxAll    = document.getElementById("checkbox-all");
	
	const controlBlockHeight = controlBlock.offsetHeight + 5;
	searchBlock.style.marginTop = controlBlockHeight + "px";
	
	let foundElements                  = []; //Коллекция узлов, имеющих класс "found-result"
	let foundElementsPos               = -1; //Индекс текущего подсвеченного узла в коллекции foundElements
	let foundElementPositionInDocument = {left: 0, top: 0}; //Координаты текущего подсвеченного узла, либо клика
	let flagClick                      = false;
	
	searchBlock.addEventListener("click", handlerSearchBlock);
	
	controlInputText.addEventListener( "input", handlerInputText );
	controlButtonBegin.addEventListener( "click", handlerButtonBegin );
	controlButtonPrevious.addEventListener( "click", () => handlerNextPrevious("previous") );
	controlButtonNext.addEventListener( "click", () => handlerNextPrevious("next") );
	controlCheckboxAll.addEventListener( "input", handlerCheckboxAll );
	document.addEventListener("keydown", handlerKeydown);
	
	handlerInputText();
	
	function handlerSearchBlock(event) {
		flagClick = true;
		foundElementPositionInDocument = {
			left: event.clientX + document.documentElement.scrollLeft,
			top:  event.clientY + document.documentElement.scrollTop,
		};
	}
	
	function handlerInputText() {
		unwrapTextNodes(searchBlock, wrapBlank);
		
		foundElements    = [];
		foundElementsPos = -1;
		let searchText = controlInputText.value.trim().toLocaleLowerCase();
		if (searchText.length > 0) {
			wrapTextNodes(searchBlock, searchText, wrapBlank);
			foundElements = searchBlock.querySelectorAll("." + wrapBlank.className);
			if (foundElements.length > 0) {
				if (controlCheckboxAll.checked)
					for (let i = 0; i < foundElements.length; ++i)
						foundElements[i].classList.add(classNameFoundAll);
				
				flagClick = false;
				foundElementsPos = elementPositionInDocumentToArrayPosition(foundElements, foundElementPositionInDocument);
				foundElementPositionInDocument = getElementPositionInDocument(foundElements[foundElementsPos]);
				foundElements[foundElementsPos].classList.add(classNameFoundCurrent);
				scrollToFoundElement(foundElements[foundElementsPos], controlBlockHeight);
			}
		}
	}
	function handlerButtonBegin() {
		foundElementPositionInDocument = {left: 0, top: 0};
		handlerInputText();
	}
	function handlerNextPrevious(strNextOrPrevious) {
		if (foundElements.length === 0)
			return;
		
		foundElements[foundElementsPos].classList.toggle(classNameFoundCurrent);
		
		let inc = 1;
		if (flagClick) {
			flagClick = false;
			inc = 0;
			foundElementsPos = elementPositionInDocumentToArrayPosition(foundElements, foundElementPositionInDocument);
		}
		foundElementsPos += strNextOrPrevious === "next" ? inc : -1;
		if (foundElementsPos >= foundElements.length)
			foundElementsPos = 0;
		else if (foundElementsPos < 0)
			foundElementsPos = foundElements.length - 1;
		
		foundElementPositionInDocument = getElementPositionInDocument(foundElements[foundElementsPos]);
		foundElements[foundElementsPos].classList.toggle(classNameFoundCurrent);
		scrollToFoundElement(foundElements[foundElementsPos], controlBlockHeight);
	}
	function handlerCheckboxAll() {
		const actionName = controlCheckboxAll.checked ? "add" : "remove";
		for (let i = 0; i < foundElements.length; ++i)
			foundElements[i].classList[actionName](classNameFoundAll);
	}
	function handlerKeydown(event) {
		if (event.code === "KeyF" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			controlInputText.focus();
		}
	}
}

textSearch();



















