import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CloudAppConfigService, CloudAppRestService, CloudAppEventsService, Entity } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { AppService } from '../app.service';
import { map } from 'rxjs/operators';
import { LibrisService } from '../libris.service';
import { LibrisItem } from '../models/librisitem';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})

export class MainComponent implements OnInit, OnDestroy {

  private subscription$: Subscription;
  private pageLoad$: Subscription;

  librisitems: LibrisItem []
  pageEntities: Entity[];
  hasAlmaApiResult: boolean = false;
  config: any;
  sigels: any;
  authToken: string;
  numberofAlmaItems: any;
  nrofLibrisItemsReceived: any;
  hasLibrisResult: boolean;

  constructor(private configService: CloudAppConfigService,
    private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService,
    private appService: AppService,
    private translate: TranslateService,
    private toastr: ToastrService,
    private librisservice: LibrisService) { 
  } 

  ngOnInit() {
    this.eventsService.getAuthToken().subscribe(authToken => this.authToken = authToken);
    this.configService.get().pipe(
      map(conf=>{
        this.config = conf;
        this.sigels = this.config.LibrisSigelTemplate;            
        this.setLang("sv");
        this.pageLoad()
      })
    ).subscribe()
  }

  pageLoad() {
    this.hasAlmaApiResult = false
    this.pageLoad$ = this.eventsService.onPageLoad(async pageInfo => { 
      const entities = (pageInfo.entities||[])
      if (entities.length > 0) {
        if(this.subscription$) {
          this.subscription$.unsubscribe();
        }
        this.librisitems = []
        this.hasAlmaApiResult = true
        this.nrofLibrisItemsReceived = 0
        this.pageEntities = pageInfo.entities;
        this.hasLibrisResult = false
        this.numberofAlmaItems  = pageInfo.entities.length
        if(entities[0].type == "ITEM"){
          this.subscription$ = this.getAlmaDetails(this.pageEntities[0].link, entities[0].type)
          .subscribe()
        } else {
          this.subscription$ = this.getAlmaDetails(`/bibs?mms_id=${this.pageEntities.map(e=>e.id).join(',')}&view=brief`, "")
          .subscribe()
        }
      }
    });
  }
  
  getAlmaDetails(url: string, type: string) {
    return this.restService.call(url)
    .pipe(
      map((bibs) => {
        let bibdata: any = [];
        let entities: any = [];
        let index: number;
        if(type == "ITEM"){
          bibdata.push(bibs.bib_data);
          entities.push(this.pageEntities[0])
        } else {
          bibdata = bibs.bib;
          entities = this.pageEntities
        }
        for(const bib of bibdata) {
          const librisarr = this.librisservice.getLibrisType(bib.network_number)
          this.librisservice.getLibrisInstance(librisarr[0], librisarr[1], this.config.librisUrl).pipe(
            map(async lib=>{
              if(type == "ITEM"){
                index = 0 
              } else {
                index = entities.findIndex(obj => obj.id==bib.mms_id)
              }
              this.librisitems[index] = await this.librisservice.getLibrisItem(lib, bib, index, this.sigels)
              this.nrofLibrisItemsReceived++;
              if (this.nrofLibrisItemsReceived >= entities.length) {
                this.hasLibrisResult = true;
              } 
            })
          )
          .subscribe()
        }
      })
    )
  }

  ngOnDestroy(): void {
    this.pageLoad$.unsubscribe();
    this.subscription$.unsubscribe();
  }

  setLang(lang: string) {
    this.translate.use(lang);
  }
  
}
