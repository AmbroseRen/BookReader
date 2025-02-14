import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild, OnDestroy, HostListener, Inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatDrawer } from '@angular/material/sidenav';
import { TouchEmitter } from './touch-emitter';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { DialogSettingsComponent } from './dialog-settings/dialog-settings.component';
import { Settings } from './settings';
import { DOCUMENT } from '@angular/common';
// import { ePub  } from '@angular/core';
declare var ePub: any;

const storageString = 'result';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, AfterViewInit {





  // Load the opf
  rendition: any = null;
  book: any = null;
  touchEventStart: TouchEmitter;
  touchEventLast: TouchEmitter;
  navigationData: any = null;
  testUrl: string;
  bookName: string = null;
  theme: string;
  searchControl = new FormGroup({
    searchKeyWord: new FormControl(null, [
      Validators.required,
      Validators.nullValidator, Validators.minLength(1), Validators.maxLength(2000)
    ]),
    searchAll: new FormControl(false, [])
  });
  location: any;
  resItems: any = null;
  searching = false;
  search = false;
  showMainSearchButton = false;
  screenWidth = 0;
  @ViewChild('inputfile') inputfile: ElementRef;
  @ViewChild('drawer') drawer: MatDrawer;
  constructor(
    public dialog: MatDialog,
    public detector: NgZone,
    private bottomSheet: MatBottomSheet,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.screenWidth = document.body.clientWidth;
  }
  @HostListener('window:unload', ['$event'])
  unloadHandler(event) {
    // ...
  }
  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    console.log(event.code === 'KeyM')
    if (event.code === 'KeyM') {
      this.drawToggle();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event) {
    if (this.book) {
      const chars = 1650;
      const key = `${this.book.key()}:locations-${chars}`;
      localStorage.setItem(key, JSON.stringify(this.rendition.currentLocation().end.cfi));
    }
  }
  ngOnInit(): void {
    const settings = JSON.parse(localStorage.getItem(storageString));
    if (settings) {
      if (settings.theme) {
        this.theme = settings.theme;
        this.document.body.classList.replace(this.document.body.classList[0], settings.theme);
      } else {
        this.theme = this.document.body.classList[0];
      }
    }
  }
  ngAfterViewInit(): void {
  }

  uploadFileClick() {
    this.inputfile.nativeElement.click();
  }
  /*
  * 读取文件内容
  */
  processFiles(file: any): void {
    file = file.target.files[0];
    this.bookName = file.name;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.openBook(e);
      };
      reader.readAsArrayBuffer(file);
    }
  }
  drawToggle(): void {
    this.detector.run(() => {
      this.drawer.toggle();
    });
  }
  openBook(e: any) {
    const bookData = e.target.result;
    this.book = ePub();
    this.book.open(bookData, 'binary');
    this.rendition = this.book.renderTo('viewer', {
      method: 'continuous',
      // method: 'default',
      // manager: 'continuous',
      manager: 'default',
      flow: 'scrolled',
      // flow: 'auto',
      // flow: "paginated",
      width: '100%',
      height: '100%'
    });
    // this.rendition.spread('always',1000);
    // aslo can set px
    const settings = JSON.parse(localStorage.getItem(storageString));
    if (settings) {
      this.rendition.themes.fontSize(settings.fontSizeValue);
    } else {
      this.rendition.themes.fontSize('140%');
    }
    this.rendition.display();
    this.rendition.hooks.content.register((contents: any) => {
      const el = contents.document.documentElement;
      contents.innerHeight = contents.innerHeight * 2;
      if (el) {
        console.log(this.mobileCheck())
        if (this.mobileCheck()) {
          el.addEventListener('click', (event: MouseEvent) => {
            const screenY = window.screenY;
            const x = this.screenWidth / 3;
            const y = screenY / 3;
            if (event.clientX > x && event.clientX < x * 2) {
              this.drawToggle();
            }
          })
        } else {
          el.addEventListener('keyup', (event: KeyboardEvent) => {
            console.log(event.code)
            if (event.code === 'KeyM') {
              this.drawToggle();
            }
          })
        }
        // Enable swipe gesture to flip a page
        let start: Touch;
        let end: Touch;
        el.addEventListener('touchstart', (event: TouchEvent) => {
          start = event.changedTouches[0];
        });
        el.addEventListener('touchend', (event: TouchEvent) => {
          end = event.changedTouches[0];
          const screenX = event.view.innerWidth;
          const screenY = event.view.innerHeight;
          const hr = (end.screenX - start.screenX) / screenX;
          const vr = Math.abs((end.screenY - start.screenY) / screenY);
          if (hr > 0.25 && vr < 0.01) { return this.rendition.prev(); }
          if (hr < -0.25 && vr < 0.01) { return this.rendition.next(); }
        });
      }
    });

    this.book.loaded.navigation.then((toc: any) => {
      this.navigationData = toc;
    });
    this.rendition.on('keyup', (event: any) => {
      // Left Key
      if ((event.keyCode || event.which) === 37) {
        this.previewPage();
      }
      // Right Key
      if ((event.keyCode || event.which) === 39) {
        this.nextPage();
      }
    });
    // this.rendition.themes.default({
    //   defalt: 'bookreader-dark-theme',
    // });
    const style = getComputedStyle(this.document.body);
    this.rendition.themes.default({ body: { color: style.color, font: style.font, padding: '20px' } });
    this.rendition.on('relocated', (location: any) => {
    });
    this.book.ready.then(() => {
      const chars = 1650;
      const key = `${this.book.key()}:locations-${chars}`;
      const stored = JSON.parse(localStorage.getItem(key));
      if (stored) {
        localStorage.removeItem(key);
        return this.rendition.display(stored);
      }
    });
  }
  nextPage() {
    if (this.rendition) {
      this.rendition.next();
    }
  }
  previewPage() {
    if (this.rendition) {
      this.rendition.prev();
    }
  }
  onKeyUp(event: number) { // without type info
    if (event === 0) {
      this.previewPage();
    } else if (event === 1) {
      this.nextPage();
    }
  }
  touchOnMove(event: TouchEmitter) {
    this.touchEventLast = event;
  }
  touchOnStart(event: TouchEmitter) {
    this.touchEventStart = event;
  }
  touchOnEnd(touchend: TouchEmitter) {
    if (touchend.direction === 0) {
      this.nextPage();
    } else if (touchend.direction === 1) {
      this.previewPage();
    }
  }
  // https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
  mobileCheck() {
    let check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor);
    return check;
  };
  onSubmit(f: any) {
    if (!f.searchKeyWord) {
      return;
    }
    this.searching = true;
    if (f.searchAll) {
      this.doSearch(f.searchKeyWord);
    } else {
      this.doChapterSearch(f.searchKeyWord);
    }
  }
  doSearch(q: string) {
    this.resItems = null;
    Promise.all(
      this.book.spine.spineItems.map(item =>
        item.load(this.book.load.bind(this.book))
          .then(item.find.bind(item, q))
          .finally(item.unload.bind(item))
      )
    ).then(results => {
      const rea = [].concat.apply([], results);
      if (rea.length === 0) {
        this.showMainSearchButton = false;
      } else {
        this.showMainSearchButton = true;
      }
      this.resItems = rea;
      this.searching = false;
    });
  }

  doChapterSearch(q: string) {
    this.resItems = null;
    const item = this.book.spine.get(this.location);
    const res = item.load(this.book.load.bind(this.book)).then(item.find.bind(item, q)).finally(item.unload.bind(item));
    res.then(r => {
      if (r.length === 0) {
        this.showMainSearchButton = false;
      } else {
        this.showMainSearchButton = true;
      }
      this.resItems = r;
      this.searching = false;
    });
  }
  /*
  *0:
  cfi: "epubcfi(/6/10[id4]!/4/8,/1:62,/1:63)"
  excerpt: "...↵我像傻瓜一样混进首吠破的似乎是纯种老北京人开的冷面馆子..."
  */
  selectNavigationForSearch($event, item: any) {
    this.detector.run(() => (this.search = false));
    this.rendition.display(item.cfi);
  }

  selectNavigation(event: any, navigation: any) {
    const url = navigation.href;
    this.testUrl = url;
    this.rendition.display(url);
  }

  fullScreen() {
    const element: any = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    }
  }
  openSettingsDialog() {
    const settings = JSON.parse(localStorage.getItem(storageString));
    const valueSizeTemp = this.rendition?.themes._overrides['font-size'].value;
    const dialogRef = this.dialog.open(DialogSettingsComponent, {
      width: '80vw',
      hasBackdrop: false,
      data: {
        settings: new Settings(settings ? settings.fontSizeValue : this.rendition?.themes._overrides['font-size'].value,
          this.theme),
        rendition: this.rendition
      }
    });

    dialogRef.afterClosed().subscribe((result: Settings) => {
      if (result) {
        if (this.rendition) {
          if (valueSizeTemp !== result.fontSizeValue) {
            const location = this.rendition.currentLocation().start;
            this.rendition.themes.fontSize(result.fontSizeValue);
            this.rendition.display();
            this.rendition.display(location.cfi);
          }
        }
        this.detector.run(() => (this.document.body.classList.replace(this.theme, result.theme)));
        localStorage.setItem(storageString, JSON.stringify(result));
      }
    });
  }

}
