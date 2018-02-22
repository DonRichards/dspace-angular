import { Inject, Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { GLOBAL_CONFIG, GlobalConfig } from '../../../config';
import { BrowseService } from '../browse/browse.service';
import { RemoteDataBuildService } from '../cache/builders/remote-data-build.service';
import { ResponseCacheService } from '../cache/response-cache.service';
import { CoreState } from '../core.reducers';
import { DataService } from '../data/data.service';
import { RequestService } from '../data/request.service';
import { NormalizedPoolTask } from './models/normalized-pool-task-object.model';
import { PoolTask } from './models/pool-task-object.model';
import {
  MessagePostRequest, PostRequest, RestRequest, SubmissionPostRequest,
  TaskPostRequest
} from '../data/request.models';
import { HttpOptions } from '../dspace-rest-v2/dspace-rest-v2.service';
import { isEmpty, isNotEmpty } from '../../shared/empty.util';
import { ErrorResponse, MessageResponse, RestResponse } from '../cache/response-cache.models';
import { ResponseCacheEntry } from '../cache/response-cache.reducer';
import { HttpHeaders } from '@angular/common/http';

@Injectable()
export class PoolTaskDataService extends DataService<NormalizedPoolTask, PoolTask> {
  protected linkName = 'pooltasks';
  protected overrideRequest = true;

  constructor(protected responseCache: ResponseCacheService,
              protected requestService: RequestService,
              protected rdbService: RemoteDataBuildService,
              protected store: Store<CoreState>,
              @Inject(GLOBAL_CONFIG) protected EnvConfig: GlobalConfig,
              private bs: BrowseService) {
    super(NormalizedPoolTask);
  }

  public claimTask(body: any, scopeId: string ): Observable<any> {
    return this.postToEndpoint('', this.prepareBody(body), scopeId, this.makeHttpOptions());
  }

  public getScopedEndpoint(scopeID: string): Observable<string> {
    return this.getEndpoint();
  }

  protected fetchRequest(request: RestRequest): Observable<any> {
    const [successResponse, errorResponse] = this.responseCache.get(request.href)
      .map((entry: ResponseCacheEntry) => entry.response)
      .do(() => this.responseCache.remove(request.href))
      .partition((response: RestResponse) => response.isSuccessful);
    return Observable.merge(
      errorResponse.flatMap((response: ErrorResponse) =>
        Observable.throw(new Error(response.errorMessage))),
      successResponse
        .map((response: MessageResponse) => response)
        .distinctUntilChanged());
  }

  protected getEndpointByMethod(endpoint: string, method: string): string {
    return isNotEmpty(method) ? `${endpoint}/${method}` : `${endpoint}`;
  }

  protected postToEndpoint(linkName: string, body: any, scopeId?: string, options?: HttpOptions): Observable<any> {
    return this.getEndpoint(linkName)
      .filter((href: string) => isNotEmpty(href))
      .map((endpointURL: string) => this.getEndpointByIDHref(endpointURL, scopeId))
      .distinctUntilChanged()
      .map((endpointURL: string) => new TaskPostRequest(this.requestService.generateRequestId(), endpointURL, body, options))
      .do((request: PostRequest) => this.requestService.configure(request, true))
      .flatMap((request: PostRequest) => this.fetchRequest(request))
      .distinctUntilChanged();
  }

  protected getEndpointByIDHref(endpoint, resourceID): string {
    return isNotEmpty(resourceID) ? `${endpoint}/${resourceID}` : `${endpoint}`;
  }

  protected prepareBody(body: any) {
    let queryParams = '';
    if (isNotEmpty(body) && typeof body === 'object') {
      Object.keys(body)
        .forEach((param) => {
          const paramValue = `${param}=${body[param]}`;
          queryParams = isEmpty(queryParams) ? queryParams.concat(paramValue) : queryParams.concat('&', paramValue);
        });
    }
    return encodeURI(queryParams);
  }

  protected makeHttpOptions() {
    const options: HttpOptions = Object.create({});
    let headers = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/json');
    options.headers = headers;
    return options;
  }

  /*
    findAll(options: FindAllOptions = {}): Observable<RemoteData<PaginatedList<PoolTask>>> {
      const hrefObs = this.getEndpoint().filter((href: string) => isNotEmpty(href))
        .flatMap((endpoint: string) => this.getFindAllHref(endpoint, options));

      hrefObs
        .filter((href: string) => hasValue(href))
        .take(1)
        .subscribe((href: string) => {
          const request = new SubmissionFindAllRequest(this.requestService.generateRequestId(), href, options);
          this.requestService.configure(request);
        });

      return this.rdbService.buildList<NormalizedPoolTask, PoolTask>(hrefObs, this.normalizedResourceType) as Observable<RemoteData<PaginatedList<PoolTask>>>;
    }

    findById(id: string): Observable<RemoteData<PoolTask>> {
      const hrefObs = this.getEndpoint()
        .map((endpoint: string) => this.getFindByIDHref(endpoint, id));

      hrefObs
        .filter((href: string) => hasValue(href))
        .take(1)
        .subscribe((href: string) => {
          const request = new SubmissionFindByIDRequest(this.requestService.generateRequestId(), href, id);
          this.requestService.configure(request);
        });

      return this.rdbService.buildSingle<NormalizedPoolTask, PoolTask>(hrefObs, this.normalizedResourceType);
    }

    findByHref(href: string): Observable<RemoteData<PoolTask>> {
      this.requestService.configure(new SubmissionRequest(this.requestService.generateRequestId(), href));
      return this.rdbService.buildSingle<NormalizedPoolTask, PoolTask>(href, this.normalizedResourceType);
    }*/
}
